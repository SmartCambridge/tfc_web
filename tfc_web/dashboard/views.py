from django.shortcuts import redirect, get_object_or_404, render

from dashboard.models import Layout


def design(request):
    if request.method == "POST":
        if 'name' in request.POST and 'design' in request.POST and request.POST['design']:
            layout = Layout.objects.create(name=request.POST['name'], design=request.POST['design'])
            return redirect('dashboard-layout-config', layout.id)
    return render(request, 'dashboard/design.html')


def layout_config(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    return render(request, 'dashboard/layout_config.html', {'layout': layout})
