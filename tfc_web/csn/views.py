import json
import requests
from datetime import datetime, timedelta
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.shortcuts import render, redirect, get_object_or_404
from csn.everynet_api import everynet_add_device, everynet_remove_device
from csn.forms import LWDeviceForm, LWApplicationForm
from csn.models import LWDevice, LWApplication, LOGGER


@login_required
def devices(request):
    return render(request, 'csn/devices.html', {
        'devices': LWDevice.objects.filter(user_id=request.user.pk)
    })


@login_required
def device(request, device_id):
    lwdevice = get_object_or_404(LWDevice, user_id=request.user.pk, id=device_id)
    return render(request, 'csn/device.html', {
        'device': lwdevice,
    })


@login_required
def new_device(request):
    lwdevice_form = LWDeviceForm(user=request.user)
    if request.method == "POST":
        lwdevice_form = LWDeviceForm(request.POST, user=request.user)
        try:
            if lwdevice_form.is_valid():
                lwdevice = lwdevice_form.save(commit=False)
                lwdevice.user = request.user
                lwdevice.activation_type = request.POST['activation_type']
                if lwdevice.activation_type == "abp":
                    lwdevice.nwkskey = request.POST['nwkskey']
                    lwdevice.appskey = request.POST['appskey']
                    lwdevice.dev_addr = request.POST['dev_addr']
                elif lwdevice.activation_type == "otaa":
                    lwdevice.app_key = request.POST['app_key']
                else:
                    raise ValidationError("Activation type not supported")
                lwdevice.full_clean()
                if everynet_add_device(lwdevice):
                    lwdevice.save()
                    return redirect('csn_devices')
                else:
                    lwdevice_form.add_error(field=None, error=lwdevice.error_message)
        except Exception as e:
            lwdevice_form.add_error(field=None, error=str(e))
    return render(request, 'csn/new_device.html', {
        'form': lwdevice_form
    })


@login_required
def delete_device(request):
    if request.method == "POST":
        lwdevice = get_object_or_404(LWDevice, user_id=request.user.pk, dev_eui=request.POST['dev_eui'])
        if everynet_remove_device(lwdevice):
            lwdevice.delete()
        else:
            messages.error(request, lwdevice.error_message)
    return redirect('csn_devices')


@login_required
def applications(request):
    return render(request, 'csn/applications.html', {
        'applications': LWApplication.objects.filter(user_id=request.user.pk)
    })


@login_required
def application(request, app_id):
    lwapp = get_object_or_404(LWApplication, user_id=request.user.pk, id=app_id)
    return render(request, 'csn/application.html', {
        'application': lwapp,
    })


@login_required
def new_app(request):
    lwapplication_form = LWApplicationForm()
    if request.method == "POST":
        lwapplication_form = LWApplicationForm(request.POST)
        if lwapplication_form.is_valid():
            lwapplication = lwapplication_form.save(commit=False)
            lwapplication.user = request.user
            lwapplication.save()
            return redirect('csn_applications')
    return render(request, 'csn/new_application.html', {
        'form': lwapplication_form,
    })


@login_required
def delete_app(request):
    if request.method == "POST":
        lwapp = get_object_or_404(LWApplication, user_id=request.user.pk, id=request.POST['app_id'])
        lwapp.delete()
    return redirect('csn_applications')


def network_info(request):
    gateways = None
    error = False
    headers = \
        {
            'Authorization': settings.LW_API_KEY,
            'Content-Type': 'application/json'
        }
    response = requests.get(settings.EVERYNET_API_ENDPOINT + "gateways", headers=headers)
    if response.status_code != 200:
        LOGGER.error(response)
        error = True
    else:
        try:
            gateways = json.loads(response.content.decode('utf-8'))
        except Exception as e:
            LOGGER.error(e)
            error = True

    return render(request, 'csn/network_info.html', {
        'gateways': gateways['gateways'] if gateways and 'gateways' in gateways else None,
        'error': error,
    })


def gateway(request, gw_mac):
    error = False
    total_json = None
    headers = \
        {
            'Authorization': settings.LW_API_KEY,
            'Content-Type': 'application/json'
        }
    response_total = requests.get(settings.EVERYNET_API_ENDPOINT + "statistics/gateway/%s/total" % gw_mac,
                                  headers=headers)
    if response_total.status_code != 200:
        LOGGER.error(response_total)
        error = True
    else:
        try:
            total_json = json.loads(response_total.content.decode('utf-8'))
        except Exception as e:
            LOGGER.error(e)
            error = True
    response_graph = requests.get(
        settings.EVERYNET_API_ENDPOINT + "statistics/gateway/%s/graph?from_time=%s&to_time=%s&step=%s" %
        (gw_mac, int((datetime.utcnow() - timedelta(days=7)).timestamp()), int(datetime.utcnow().timestamp()), 1800),
        headers=headers)
    if response_graph.status_code != 200:
        LOGGER.error(response_graph)
        error = True

    return render(request, 'csn/gateway.html', {
        'total': total_json['total'] if total_json and 'total' in total_json else None,
        'graph': response_graph.content,
        'error': error,
        'gw_mac': gw_mac,
    })
