from django.contrib import messages
from django.contrib.auth.decorators import login_required, user_passes_test
from django.http import HttpResponseNotFound
from django.shortcuts import render, redirect, get_object_or_404
from csn.everynet_api import everynet_add_device, everynet_remove_device
from csn.forms import LWDeviceForm, LWDeviceFormExtended, LWHTTPConnection, \
    LWHTTPConnectionConfirmation, LWHTTPConnectionDevicesForm
from csn.models import Sensor, Connection


@login_required
def devices(request):
    return render(request, 'csn/devices.html', {
        'devices': Sensor.get_all_lorawan(user_id=request.user.id),
    })


@login_required
def device(request, device_id):
    lwdevice = Sensor.get_lorawan(sensor_id=device_id, user_id=request.user.id)
    return render(request, 'csn/device.html', {
        'device': lwdevice,
    }) if lwdevice else HttpResponseNotFound()


@login_required
def new_device(request):
    lwdevice_form = LWDeviceForm(user=request.user)
    if request.method == "POST":
        lwdevice_form = LWDeviceFormExtended(request.POST, user=request.user)
        try:
            if lwdevice_form.is_valid():
                lwdevice = lwdevice_form.cleaned_data
                if everynet_add_device(lwdevice, request.user.id):
                    Sensor.insert_lorawan(info=lwdevice)
                    return redirect('csn_devices')
                else:
                    lwdevice_form.add_error(field=None, error=lwdevice['error_message'])
        except Exception as e:
            lwdevice_form.add_error(field=None, error=str(e))
        lwdevice_form.fields.pop('activation_type')
        lwdevice_form.fields.pop('nwkskey')
        lwdevice_form.fields.pop('appskey')
        lwdevice_form.fields.pop('dev_addr')
        lwdevice_form.fields.pop('app_key')
    return render(request, 'csn/new_device.html', {
        'form': lwdevice_form
    })


@login_required
def delete_device(request):
    if request.method == "POST":
        lwdevice = Sensor.get_lorawan(sensor_id=request.POST['sensor_id'], user_id=request.user.id)
        if not lwdevice:
            return HttpResponseNotFound()
        if everynet_remove_device(lwdevice):
            lwdevice.delete()
            messages.info(request, "Device deleted")
        else:
            messages.error(request, lwdevice.error_message)
    return redirect('csn_devices')


@login_required
def connections(request):
    return render(request, 'csn/connections.html', {
        'connections': Connection.objects.filter(user=request.user)
    })


@login_required
def connection(request, connection_id):
    lwconnection = Connection.objects.filter(user=request.user, id=connection_id)
    if not lwconnection:
        return HttpResponseNotFound()
    connection = lwconnection[0]
    existing_dev_ids = connection.info['devices'] if 'devices' in connection.info else []
    devices = Sensor.get_all_lorawan(request.user.id).filter(id__in=existing_dev_ids)
    return render(request, 'csn/connection.html', {
        'connection': connection,
        'devices': devices
    })



@login_required
def new_connection(request):
    lwhttpconnection_form = LWHTTPConnection()
    if request.method == "POST":
        lwhttpconnection_form = LWHTTPConnection(request.POST)
        if lwhttpconnection_form.is_valid():
            Connection.objects.create_lwhttp_object(info=lwhttpconnection_form.cleaned_data, user=request.user)
            return redirect('csn_connections')
    return render(request, 'csn/new_connection.html', {
        'form': lwhttpconnection_form,
    })


@login_required
def delete_connection(request):
    if request.method == "POST":
        if not Connection.objects.filter(
                id=request.POST['connection_id']).lwhttp_objects().owned_by_user(request.user).delete():
            HttpResponseNotFound()
    return redirect('csn_connections')


# Checks if the user is a superuser (admin)
@user_passes_test(lambda u: u.is_superuser)
def confirm_connection_id(request, connection_id):
    connection = get_object_or_404(Connection, id=connection_id)
    if 'connection_id' in connection.info:
        httpconnconfirmation_form = LWHTTPConnectionConfirmation({'connection_id': connection.info['connection_id']})
    else:
        httpconnconfirmation_form = LWHTTPConnectionConfirmation()
    if request.method == "POST":
        httpconnconfirmation_form = LWHTTPConnectionConfirmation(request.POST)
        if httpconnconfirmation_form.is_valid():
            connection.info['connection_id'] = httpconnconfirmation_form.cleaned_data['connection_id']
            connection.save()
            # TODO send email to user to inform them that this has been done
            return render(request, 'csn/connection_confirmation.html')
    return render(request, 'csn/connection_confirmation.html', {
        'form': httpconnconfirmation_form,
        'connection': connection
    })


@login_required
def devices_per_connection(request, connection_id):
    lwconnection = Connection.objects.filter(id=connection_id).owned_by_user(request.user)
    if not lwconnection:
        return HttpResponseNotFound()
    connection = lwconnection[0]
    existing_dev_ids = connection.info['devices'] if 'devices' in connection.info else []
    httpconndevices_form = LWHTTPConnectionDevicesForm(user=request.user)
    httpconndevices_form.fields['devices'].initial = existing_dev_ids
    if request.method == "POST":
        httpconndevices_form = LWHTTPConnectionDevicesForm(request.POST, user=request.user)
        if httpconndevices_form.is_valid():
            connection.info['devices'] = list(set(httpconndevices_form.cleaned_data['devices']
                                                  .values_list('id', flat=True)))
            connection.save()
            # TODO send it via API
            return redirect('csn_connection', connection.id)
    return render(request, 'csn/devices_per_connection.html', {
        'connection': connection,
        'form': httpconndevices_form
    })
