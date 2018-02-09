import json
from django.shortcuts import redirect, get_object_or_404, render
from dashboard.models import Layout
import logging


logger = logging.getLogger(__name__)


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
        for key, value in data.items():
            data[key.strip("widget-")] = data.pop(key)
        layout.configuration = data
        layout.save()
    return render(request, 'dashboard/layout_config.html',
                  {'layout': layout, 'confdata': generate_layout_configuration(layout)})


def layout(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    return render(request, 'dashboard/layout.html',
                  {'layout': layout, 'confdata': generate_layout_configuration(layout)})
