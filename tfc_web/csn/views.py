from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from csn.models import LWDeviceForm, LWDevice, LWCallbackURLFormSet, LWApplication, LWApplicationForm


@login_required
def devices(request):
    return render(request, 'csn/devices.html', {
        'devices': LWDevice.objects.filter(user=request.user)
    })


@login_required
def new_device(request):
    lwdevice_form = LWDeviceForm()
    if request.method == "POST":
        lwdevice_form = LWDeviceForm(request.POST)
        if lwdevice_form.is_valid():
            lwdevice = lwdevice_form.save(commit=False)
            lwdevice.user = request.user
            lwdevice.save()
            return redirect('csn_home')
    return render(request, 'csn/new_device.html', {
        'form': lwdevice_form
    })


@login_required
def applications(request):
    return render(request, 'csn/applications.html', {
        'applications': LWApplication.objects.filter(user=request.user)
    })


@login_required
def new_application(request):
    lwapplication_form = LWApplicationForm()
    lwcallbackurls_form = LWCallbackURLFormSet()
    if request.method == "POST":
        lwapplication_form = LWApplicationForm(request.POST)
        lwcallbackurls_form = LWCallbackURLFormSet(request.POST)
        if lwapplication_form.is_valid():
            lwapplication = lwapplication_form.save(commit=False)
            lwcallbackurls_form = LWCallbackURLFormSet(request.POST, instance=lwapplication)
            if lwcallbackurls_form.is_valid():
                lwapplication.user = request.user
                lwapplication.save()
                lwcallbackurls_form.save()
                return redirect('csn_home')
    return render(request, 'csn/new_application.html', {
        'form': lwapplication_form,
        'inline_form': lwcallbackurls_form,
    })
