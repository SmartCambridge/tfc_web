import requests
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from csn.models import LWDeviceForm, LWDevice


@login_required
def new_device(request):
    lwdevice_form = LWDeviceForm()
    if request.method == "POST":
        lwdevice_form = LWDeviceForm(request.POST)
        if lwdevice_form.is_valid():
            lwdevice = lwdevice_form.save(commit=False)
            lwdevice.user = request.user
            lwdevice.save()
            r = requests.post(settings.EVERYNET_API_ENDPOINT+"devices")
            return redirect('csn_home')
    return render(request, 'csn/new_device.html', {
        'form': lwdevice_form
    })


@login_required
def devices(request):
    return render(request, 'csn/devices.html', {
        'devices': LWDevice.objects.filter(user=request.user)
    })
