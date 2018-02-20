import logging
import json
from django.shortcuts import redirect, get_object_or_404, render
from dashboard.forms import ScreenForm
from dashboard.models import Layout, Screen


logger = logging.getLogger(__name__)


def my(request):
    return render(request, 'dashboard/my.html', {'dashboards': Layout.objects.all()})


def design(request):
    if request.method == "POST":
        if 'name' in request.POST and 'design' in request.POST and request.POST['design']:
            layout = Layout.objects.create(name=request.POST['name'], design=json.loads(request.POST['design']))
            return redirect('dashboard-layout-config', layout.id)
    return render(request, 'dashboard/design.html')


def generate_layout_configuration(layout):
    confdata = {}
    for key, value in layout.design.items():
        confdata[key] = {'design': layout.design[key]}
        if layout.configuration and key in layout.configuration:
            confdata[key]['configuration'] = layout.configuration[key]
    return confdata


def layout_config(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    if request.method == "POST" and 'data' in request.POST:
        data = json.loads(request.POST['data'])
        if layout.configuration is None:
            layout.configuration = {}
        for key, value in data.items():
            layout.configuration[key.strip("widget-")] = value
        layout.save()
    return render(request, 'dashboard/layout_config.html',
                  {'layout': layout, 'confdata': generate_layout_configuration(layout),
                   'debug': request.GET.get('debug', False)})


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
    return render(request, 'dashboard/layout.html',
                  {'layout': layout, 'confdata': confdata,
                   'unique_widgets_list': uwl})


def new_screen(request):
    screen_form = ScreenForm()
    if request.method == "POST":
        screen_form = ScreenForm(request.POST)
        if screen_form.is_valid():
            screen_form.save()
            return redirect('dashboard-home')
    return render(request, 'dashboard/new_screen.html', {'screen_form': screen_form})


def screens(request):
    return render(request, 'dashboard/screens.html', {'screens': Screen.objects.all()})
