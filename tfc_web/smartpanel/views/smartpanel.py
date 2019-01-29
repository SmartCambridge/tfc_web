import logging
import json
import os
import copy
from datetime import datetime, date, timedelta, timezone

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.views import redirect_to_login
from django.core.cache import cache
from django.db import IntegrityError
from django.http.response import JsonResponse, HttpResponse
from django.shortcuts import redirect, get_object_or_404, render
from django.templatetags.static import static
from django.urls import reverse
from django.utils.timezone import now

from smartcambridge.decorator import smartcambridge_valid_user
from smartpanel.forms import DisplayForm
from smartpanel.models import Layout, Display, Pocket

from smartcambridge import rt_crypto


logger = logging.getLogger(__name__)


def all(request):
    return render(request, 'smartpanel/layouts_list.html', {'smartpanels': Layout.objects.all().order_by('-id')})


@smartcambridge_valid_user
def layouts_list(request):
    return render(request, 'smartpanel/layouts_list.html',
                  {'smartpanels': Layout.objects.filter(owner=request.user).order_by('-id'), 'edit': True})


@smartcambridge_valid_user
def design(request):
    if request.method == "POST":
        layout = Layout.objects.create(owner=request.user, design="{}")
        return layout_config(request, layout.slug, reload=True)
    return render(request, 'smartpanel/layout_config.html',
                  {'widgets_list': generate_widget_list(request.user),
                   'settings': smartpanel_settings()})

# For the templates 'layout.html' and 'pocket.html' we read widget requirements.json files
# and build the 'scripts' and 'stylesheet' data lists for links to be embedded in the rendered template
def generate_dependencies_list(uwl):
    css_links = []
    js_links = []

    # Load the requirements dictionary from static/js/requirements.json
    requirements_dict_file = open(os.path.join(settings.BASE_DIR, 'requirements.json'))

    requirements_dict = json.load(requirements_dict_file)['keys']

    matched_keys = [] # keep track of requirement keys matched so far, avoid duplicates

    # Each dictionary entry is key -> { scripts: [...], stylesheets: [...] }
    #     where "scripts" is a list of { "src":.., ... } objects, and
    #     "stylesheets" is a list of { "href": =.., ...} objects

    # Iterate the widgets to get cumulative requirements
    for widget in uwl:
        # Add links to any local widget .js or .css files
        if os.path.exists(os.path.join(settings.BASE_DIR, 'smartpanel/static/smartpanel/widgets/%s/%s.js' % (widget, widget))):
            js_links.append({ 'src': static('smartpanel/widgets/%s/%s.js' % (widget, widget))})
        if os.path.exists(os.path.join(settings.BASE_DIR, 'smartpanel/static/smartpanel/widgets/%s/%s.css' % (widget, widget))):
            css_links.append({ 'href': static('smartpanel/widgets/%s/%s.css' % (widget, widget))})

        # Add links for script or stylesheets specified by keys in the widgete 'requirements.json' file
        try:
            # Each widget has a 'requirements.json' file containing a JSON list of requirements keys e.g. [ "leaflet", "moment" ]
            requirements_file = open(os.path.join(settings.BASE_DIR,
                                     'smartpanel/static/smartpanel/widgets/%s/requirements.json' % widget))
            keys = json.load(requirements_file)['keys'] # e.g. [ "leaflet", "moment" ]

            for key in keys:
                if not key in matched_keys: # skip this requirement key if dealt with in earlier widget
                    matched_keys.append(key)
                    requirement = requirements_dict[key]
                    if 'scripts' in requirement:
                        for script in requirement['scripts']:
                            if script.__class__ is dict:
                                js_links.append(script)
                            else:
                                js_links.append({ 'src': static(script) })
                    if 'stylesheets' in requirement:
                        for stylesheet in requirement['stylesheets']:
                            css_links.append(stylesheet)
        except FileNotFoundError:
            pass
    return { 'css': css_links, 'js': js_links }

def generate_widget_list(user):
    widget_directory = os.path.join(settings.BASE_DIR, 'smartpanel/static/smartpanel/widgets')
    list_widget_files = os.listdir(widget_directory)
    list_widgets = []
    for widget_file in list_widget_files:
        if os.path.isdir(os.path.join(settings.BASE_DIR, 'smartpanel/static/smartpanel/widgets', widget_file)):
            if (widget_file != "bikes") or (widget_file == "bikes" and user.is_superuser):
                list_widgets.append({
                    'name': json.load(open(os.path.join(widget_directory, '%s/%s_schema.json' %
                                                        (widget_file, widget_file))))['title'],
                    'file': widget_file
                })
    return list_widgets

def smartpanel_settings():
    '''
    Return a dictionary containing configuration items with names
    starting 'SMARTPANEL_' for consumption by smartpanel widgets
    '''

    filtered_settings = {}
    for attr in dir(settings):
        if attr.startswith('SMARTPANEL_'):
            value = getattr(settings, attr)
            filtered_settings[attr] = value
    return filtered_settings

@smartcambridge_valid_user
def layout_config(request, slug, reload=False):
    layout = get_object_or_404(Layout, slug=slug, owner=request.user)
    error = False
    try:
        if request.method == "POST" and 'name' in request.POST and 'design' in request.POST:
            name = request.POST['name']
            design = json.loads(request.POST['design'])
            #data = json.loads(request.POST['data'])
            #for key, value in design.items():
            #    if key in data and 'data' in data[key] and 'widget' in data[key] and 'placeholder' in data[key]:
            #        design[key]['widget'] = data[key]['widget']
            #        design[key]['data'] = data[key]['data']
            #        design[key]['placeholder'] = data[key]['placeholder']
            layout.name = name
            layout.design = design
            layout.save()
            if request.POST.get('submit-button', None) == "view":
                return redirect('smartpanel-layout', slug)
            elif request.POST.get('submit-button', None) == "display":
                layout.version += 1
                layout.version_date = now()
                layout.save()
                messages.info(request, 'SmartPanel layout published')
            elif request.POST.get('submit-button', None) == "save":
                return redirect('smartpanel-list-my-layouts')
            if reload:
                return redirect('smartpanel-layout-config', slug)
    except:
        error = True
        messages.error(request, "An error ocurred")
    return render(request, 'smartpanel/layout_config.html',
                  {'layout': layout, 'error': error,
                   'debug': request.GET.get('debug', False),
                   'widgets_list': generate_widget_list(request.user),
                   'settings': smartpanel_settings()})

@smartcambridge_valid_user
def layout_export(request, slug):
    layout = get_object_or_404(Layout, slug=slug, owner=request.user)
    response = JsonResponse(layout.design, json_dumps_params={'indent': 2})
    if request.GET.get('download'):
        response['Content-Disposition'] = 'attachment; filename="%s.json"' % slug
    return response


@smartcambridge_valid_user
def layout_import(request):
    if request.method == "POST":
        try:
            design = json.loads(request.POST.get("design", "{}"))
        except json.JSONDecodeError as e:
            messages.error(request, "Layout import failed: %s" % e.msg)
            return redirect('smartpanel-list-my-layouts')
        except Exception:
            messages.error(request, "Layout import failed, unknown error")
            return redirect('smartpanel-list-my-layouts')
        return render(request, 'smartpanel/layout_config.html',
                      {'design': design,
                       'widgets_list': generate_widget_list(request.user),
                       'settings': smartpanel_settings()
                       })
    return redirect('smartpanel-list-my-layouts')


@smartcambridge_valid_user
def layout_delete(request):
    if request.method == "POST" and 'layout_id' in request.POST:
        try:
            get_object_or_404(Layout, slug=request.POST['layout_id'], owner=request.user).delete()
        except IntegrityError:
            messages.error(request, "This Layout is being used by a Display, remove it from the Display first.")
    return redirect('smartpanel-list-my-layouts')


def layout(request, slug, display=None):
    if display is None and not request.user.is_authenticated:
        return redirect_to_login(request.get_full_path())
    if request.user.is_superuser or display:
        layout = get_object_or_404(Layout, slug=slug)
    else:
        layout = get_object_or_404(Layout, slug=slug, owner=request.user)

    # Build unique widget list from layout.design.widgets, with backsupport for layout.design
    uwl = []  # unique widget list
    if 'widgets' in layout.design:
        widgets = layout.design['widgets']
    else:
        widgets = layout.design

    for key, value in widgets.items():
        if 'widget' in value and value['widget'] not in uwl:
            uwl.append(value['widget'])

    dependencies_list = generate_dependencies_list(uwl)

    if display is None:

        # layout gets a 10-minute rt_token
        token_uri = reverse('smartpanel-layout',kwargs={ 'slug': slug})

        rt_token = rt_crypto.rt_token( token_uri,
                                       { "uses": "5",
                                         "duration": timedelta(minutes=10)
                                       } )
    else:

        # display gets a 25-hour rt_token
        token_uri = reverse('smartpanel-display', kwargs={ 'slug': display.slug })

        rt_token = rt_crypto.rt_token( token_uri,
                                       { "uses": "5",
                                         "duration": timedelta(hours=25)
                                       } )

    return render(request, 'smartpanel/layout.html',
                  {'layout': layout,
                   'stylesheets': dependencies_list['css'],
                   'scripts': dependencies_list['js'],
                   'display': display,
                   'rt_token': rt_token,
                   'RTMONITOR_URI': settings.RTMONITOR_URI,
                   'settings': smartpanel_settings()})

def layout_expired(request):
    return render(request, 'smartpanel/layout_expired.html', {})

def pocket(request, name=None):
    # The mobile display only does these widgets
    widgets = ['weather', 'station_board', 'stop_timetable', 'stop_bus_map']

    dependencies_list = generate_dependencies_list(widgets)

    rt_token = rt_crypto.rt_token( reverse("smartpanel-pocket"),
                                   { "uses": "5",
                                     "duration": timedelta(hours=25)
                                   } )

    # Retrieve the name of a set of preload page params from the URL
    # lookup in Pocket table and set preload_pages to JsonArray
    # or None if not found (or no URL value given)
    if name is not None:
        try:
            preload_pages = Pocket.objects.get(name=name).params
        except Pocket.DoesNotExist:
            preload_pages = None
    else:
        preload_pages = None

    return render(request, 'smartpanel/pocket.html',
                  {'stylesheets': dependencies_list['css'],
                   'scripts': dependencies_list['js'],
                   'display': 'mobile',
                   'rt_token': rt_token,
                   'RTMONITOR_URI': settings.RTMONITOR_URI,
                   'settings': smartpanel_settings(),
                   'preload_pages': preload_pages
                  })


@smartcambridge_valid_user
def new_display(request):
    if request.method == "POST":
        display_form = DisplayForm(request.POST, user=request.user)
        if display_form.is_valid():
            display = display_form.save(commit=False)
            display.owner = request.user
            display.save()
            return redirect('smartpanel-list-my-displays')
    else:
        display_form = DisplayForm(user=request.user)
    return render(request, 'smartpanel/display.html', {'display_form': display_form})


def displays(request):
    return render(request, 'smartpanel/displays.html', {'displays': Display.objects.all()})


def display_refresh(request, display_slug, layout_slug, version):
    display = get_object_or_404(Display, slug=display_slug)
    layout = get_object_or_404(Layout, slug=layout_slug)
    refresh_info = copy.deepcopy(request.GET)
    refresh_info['source_ip'] = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
    refresh_info['time'] = now()
    cache.set('display-%s' % display.slug, refresh_info)
    if display.layout.slug != layout.slug or display.layout.version != int(version):
        return JsonResponse({'refresh': True, 'url': reverse('smartpanel-display', args=(display_slug, ))})
    return JsonResponse({'refresh': False, 'url': reverse('smartpanel-display', args=(display_slug, ))})


def display(request, slug):
    display = get_object_or_404(Display, slug=slug)
    return layout(request, display.layout.slug, display=display)


def displays_debug(request):
    results = {}
    for display in Display.objects.all():
        results['display-%s' % display.slug] = cache.get('display-%s' % display.slug, {})
    return JsonResponse(results)


@smartcambridge_valid_user
def displays_map(request):
    return render(request, 'smartpanel/displays_map.html',
                  {'displays': Display.objects.filter(owner=request.user), 'edit': True})

@smartcambridge_valid_user
def displays_list(request):
    return render(request, 'smartpanel/displays_list.html',
                  {'displays': Display.objects.filter(owner=request.user).order_by('-id'), 'edit': True})


@smartcambridge_valid_user
def edit_display(request, slug):
    display = get_object_or_404(Display, slug=slug, owner=request.user)
    if request.method == "POST":
        display_form = DisplayForm(request.POST, instance=display, user=request.user)
        if display_form.is_valid():
            display.save()
            return redirect('smartpanel-list-my-displays')
    else:
        display_form = DisplayForm(instance=display, user=request.user)
    return render(request, 'smartpanel/display.html', {'display_form': display_form, 'edit': True})

@smartcambridge_valid_user
def display_delete(request):
    if request.method == "POST" and 'display_id' in request.POST:
        try:
            get_object_or_404(Display, slug=request.POST['display_id'], owner=request.user).delete()
        except:
            messages.error(request, "Can't delete this display")
        if request.POST['source'] == 'map':
            return redirect('smartpanel-map-my-displays')
        else:
            return redirect('smartpanel-list-my-displays')
    return redirect('smartpanel-list-my-displays')

