import logging
import json
import os
from django.conf import settings
from django.shortcuts import redirect, get_object_or_404, render
from django.templatetags.static import static
from smartpanel.forms import ScreenForm
from smartpanel.models import Layout, Screen


logger = logging.getLogger(__name__)


def my(request):
    return render(request, 'smartpanel/my.html', {'smartpanel': Layout.objects.all()})


def design(request):
    if request.method == "POST":
        if 'name' in request.POST and 'design' in request.POST and request.POST['design']:
            layout = Layout.objects.create(name=request.POST['name'], design=json.loads(request.POST['design']))
            return redirect('smartpanel-layout-config2', layout.id)
    return render(request, 'smartpanel/design.html')


def generate_layout_configuration(layout):
    confdata = {}
    for key, value in layout.design.items():
        confdata[key] = {'design': layout.design[key]}
        if layout.configuration and key in layout.configuration:
            confdata[key]['configuration'] = layout.configuration[key]
    return confdata


def generate_dependencies_files_list(uwl):
    css_files_list = []
    js_files_list = []
    external_js_files_list = []
    external_css_files_list = []
    for widget in uwl:
        js_files_list.append(static('smartpanel/widgets/%s/%s.js' % (widget, widget)))
        css_files_list.append(static('smartpanel/widgets/%s/%s.css' % (widget, widget)))
        try:
            requirements_file = open(os.path.join(settings.BASE_DIR, 'static/smartpanel/widgets/%s/requirements.json'
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


def generate_widget_list():
    widget_directory = os.path.join(settings.BASE_DIR, 'static/smartpanel/widgets')
    list_widget_files = os.listdir(widget_directory)
    list_widgets = []
    for widget_file in list_widget_files:
        if os.path.isdir(widget_file):
            list_widgets.append({
                'name': json.load(open(os.path.join(widget_directory, '%s/%s_schema.json' %
                                                    (widget_file, widget_file))))['title'],
                'file': list_widgets
            })
    return list_widgets


def layout_config(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    if request.method == "POST" and 'data' in request.POST:
        data = json.loads(request.POST['data'])
        if layout.configuration is None:
            layout.configuration = {}
        for key, value in data.items():
            layout.configuration[key.strip("widget-")] = value
        layout.save()
    return render(request, 'smartpanel/layout_config.html',
                  {'layout': layout, 'confdata': generate_layout_configuration(layout),
                   'debug': request.GET.get('debug', False), 'widgets_list': generate_widget_list()})


def layout_config2(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    if request.method == "POST" and 'data' in request.POST:
        data = json.loads(request.POST['data'])
        if layout.configuration is None:
            layout.configuration = {}
        for key, value in data.items():
            layout.configuration[key.strip("widget-")] = value
        layout.save()
    confdata = generate_layout_configuration(layout)
    uwl = []
    for key, value in confdata.items():
        if 'configuration' in value and value['configuration']['widget'] not in uwl:
            uwl.append(value['configuration']['widget'])
    dependencies_files_list = generate_dependencies_files_list(uwl)
    return render(request, 'smartpanel/layout_config2.html',
                  {'layout': layout, 'confdata': generate_layout_configuration(layout),
                   'debug': request.GET.get('debug', False), 'widgets_list': generate_widget_list(),
                   'stylesheets': dependencies_files_list[0], 'scripts': dependencies_files_list[1],
                   'external_scripts': dependencies_files_list[2], 'external_stylesheets': dependencies_files_list[3]})


def layout_delete_widget(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    if request.method == "POST" and 'widgetid' in request.POST:
        del layout.configuration[request.POST['widgetid']]
        layout.save()
    return redirect(layout_config, layout_id)


def layout(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    confdata = generate_layout_configuration(layout)
    uwl = []
    for key, value in confdata.items():
        if 'configuration' in value and value['configuration']['widget'] not in uwl:
            uwl.append(value['configuration']['widget'])
    dependencies_files_list = generate_dependencies_files_list(uwl)
    return render(request, 'smartpanel/layout.html',
                  {'layout': layout, 'confdata': confdata, 'stylesheets': dependencies_files_list[0],
                   'scripts': dependencies_files_list[1], 'external_scripts': dependencies_files_list[2],
                   'external_stylesheets': dependencies_files_list[3]})


def new_screen(request):
    screen_form = ScreenForm()
    if request.method == "POST":
        screen_form = ScreenForm(request.POST)
        if screen_form.is_valid():
            screen_form.save()
            return redirect('smartpanel-home')
    return render(request, 'smartpanel/new_screen.html', {'screen_form': screen_form})


def screens(request):
    return render(request, 'smartpanel/screens.html', {'screens': Screen.objects.all()})
