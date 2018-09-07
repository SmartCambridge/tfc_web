import logging
import json
import os
import copy
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.views import redirect_to_login
from django.core.cache import cache
from django.db import IntegrityError
from django.http.response import JsonResponse
from django.shortcuts import redirect, get_object_or_404, render
from django.templatetags.static import static
from django.urls import reverse
from django.utils.timezone import now

from smartcambridge.decorator import smartcambridge_valid_user
from smartpanel.forms import DisplayForm
from smartpanel.models import Layout, Display


logger = logging.getLogger(__name__)


def all(request):
    return render(request, 'smartpanel/my.html', {'smartpanels': Layout.objects.all().order_by('-id')})


@smartcambridge_valid_user
def my(request):
    return render(request, 'smartpanel/my.html',
                  {'smartpanels': Layout.objects.filter(owner=request.user).order_by('-id'), 'edit': True})


@smartcambridge_valid_user
def design(request):
    if request.method == "POST":
        layout = Layout.objects.create(owner=request.user, design="{}")
        return layout_config(request, layout.slug, reload=True)
    return render(request, 'smartpanel/layout_config.html',
                  {'widgets_list': generate_widget_list(request.user),
                   'settings': smartpanel_settings()})


def generate_dependencies_files_list(uwl):
    css_files_list = []
    js_files_list = []
    external_js_files_list = []
    external_css_files_list = []
    for widget in uwl:
        if os.path.exists(os.path.join(settings.BASE_DIR, 'smartpanel/static/smartpanel/widgets/%s/%s.js' % (widget, widget))):
            js_files_list.append(static('smartpanel/widgets/%s/%s.js' % (widget, widget)))
        if os.path.exists(os.path.join(settings.BASE_DIR, 'smartpanel/static/smartpanel/widgets/%s/%s.css' % (widget, widget))):
            css_files_list.append(static('smartpanel/widgets/%s/%s.css' % (widget, widget)))
        try:
            requirements_file = open(os.path.join(settings.BASE_DIR, 'smartpanel/static/smartpanel/widgets/%s/requirements.json'
                                                  % widget))
            requirements = json.load(requirements_file)
            if 'scripts' in requirements:
                for script in requirements['scripts']:
                    if script.__class__ is dict:
                        external_js_files_list.append(script)
                    else:
                        js_files_list.append(static('smartpanel/widgets/%s/%s' % (widget, script)))
            if 'stylesheets':
                for stylesheet in requirements['stylesheets']:
                    if stylesheet.__class__ is dict:
                        external_css_files_list.append(stylesheet)
                    else:
                        css_files_list.append(static('smartpanel/widgets/%s/%s' % (widget, stylesheet)))
        except:
            pass
    return (css_files_list, js_files_list, external_js_files_list, external_css_files_list)


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
        if request.method == "POST" and 'data' in request.POST and 'name' in request.POST and 'design' in request.POST:
            name = request.POST['name']
            design = json.loads(request.POST['design'])
            data = json.loads(request.POST['data'])
            for key, value in design.items():
                if key in data and 'data' in data[key] and 'widget' in data[key] and 'placeholder' in data[key]:
                    design[key]['widget'] = data[key]['widget']
                    design[key]['data'] = data[key]['data']
                    design[key]['placeholder'] = data[key]['placeholder']
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
                return redirect('smartpanel-layout-my')
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
            layout_design = json.loads(request.POST.get("design", "{}"))
        except json.JSONDecodeError as e:
            messages.error(request, "Layout import failed: %s" % e.msg)
            return redirect(my)
        except Exception:
            messages.error(request, "Layout import failed, unknown error")
            return redirect(my)
        return render(request, 'smartpanel/layout_config.html',
                      {'layout_design': layout_design,
                       'widgets_list': generate_widget_list(),
                       'settings': smartpanel_settings()})
    return redirect(my)


@smartcambridge_valid_user
def layout_delete(request):
    if request.method == "POST" and 'layout_id' in request.POST:
        try:
            get_object_or_404(Layout, slug=request.POST['layout_id'], owner=request.user).delete()
        except IntegrityError:
            messages.error(request, "This Layout is being used by a Display, remove it from the Display first.")
    return redirect('smartpanel-layout-my')


def layout(request, slug, display=None):
    if display is None and not request.user.is_authenticated:
        return redirect_to_login(request.get_full_path())
    if request.user.is_superuser or display:
        layout = get_object_or_404(Layout, slug=slug)
    else:
        layout = get_object_or_404(Layout, slug=slug, owner=request.user)
    uwl = []  # unique widget list
    for key, value in layout.design.items():
        if 'widget' in value and value['widget'] not in uwl:
            uwl.append(value['widget'])
    dependencies_files_list = generate_dependencies_files_list(uwl)
    return render(request, 'smartpanel/layout.html',
                  {'layout': layout, 'stylesheets': dependencies_files_list[0],
                   'scripts': dependencies_files_list[1], 'external_scripts': dependencies_files_list[2],
                   'external_stylesheets': dependencies_files_list[3], 'display': display, 'rt_token': '777',
                   'settings': smartpanel_settings()})


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
def my_displays(request):
    return render(request, 'smartpanel/displays.html',
                  {'displays': Display.objects.filter(owner=request.user), 'edit': True})


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
def delete_display(request, slug):
    display = get_object_or_404(Display, slug=slug, owner=request.user)
    if request.method == "POST":
        display.delete()
        return redirect('smartpanel-list-my-displays')
    return redirect('smartpanel-edit-display', display.slug)
