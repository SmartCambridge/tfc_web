from django.core.exceptions import ValidationError
from django import forms
from django.core.validators import RegexValidator, MinLengthValidator
from csn.models import Sensor

mdl_textfield_widget = forms.TextInput(attrs={'class': 'mdl-textfield__input'})
mdl_select_widget = forms.Select(attrs={'class': 'mdl-textfield__input'})


class LWDeviceForm(forms.Form):
    """Form to process LoRaWAN devices that will be stored in the Sensor table"""
    DEVICE_CLASS = (
        ('A', 'A'),
        ('C', 'C'),
    )
    COUNTERS_SIZE_OPTIONS = (
        (2, 2),
        (4, 4),
    )

    name = forms.CharField(max_length=150, widget=mdl_textfield_widget)
    description = forms.CharField(max_length=255, widget=mdl_textfield_widget)

    # Device properties
    dev_class = forms.ChoiceField(choices=DEVICE_CLASS, initial='A', widget=mdl_select_widget,
                                  label="Device Class")
    counters_size = forms.TypedChoiceField(choices=COUNTERS_SIZE_OPTIONS, initial=4, widget=mdl_select_widget,
                                           coerce=int)

    # Device EUI - 64 bit end-device identifier, EUI-64 (unique)
    # DevEUI is assigned to the device by the chip manufacturer in LoRaWAN devices.
    # However, all communication is done using DevAddr (dynamic)
    dev_eui = forms.CharField(max_length=16, validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                                         MinLengthValidator(16)], label="Device EUI",
                              widget=forms.TextInput(
                                  attrs={'class': 'mdl-textfield__input', 'pattern': '[0-9A-Fa-f]{16}',
                                         'placeholder': '16 hex characters', 'title': '16 hex characters'}))

    # Application EUI - 64 bit end-device identifier, EUI-64 (unique)
    app_eui = forms.CharField(max_length=16, validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                                         MinLengthValidator(16)], label="Application EUI",
                              widget=forms.TextInput(
                                  attrs={'class': 'mdl-textfield__input', 'pattern': '[0-9A-Fa-f]{16}',
                                         'placeholder': '16 hex characters', 'title': '16 hex characters'}))

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user')
        super(LWDeviceForm, self).__init__(*args, **kwargs)

    def clean(self):
        cleaned_data = super(LWDeviceForm, self).clean()
        cleaned_data['sensor_id'] = cleaned_data['dev_eui']
        cleaned_data['sensor_type'] = 'lorawan'
        cleaned_data['user_id'] = self.user.id
        return cleaned_data


class LWDeviceFormExtended(LWDeviceForm):
    ACTIVATION_TYPE = (
        ('otaa', 'Over the Air Activation'),
        ('abp', 'Activation by personalisation'),
    )

    activation_type = forms.ChoiceField(choices=ACTIVATION_TYPE)

    #######################################
    # Activation by personalisation (ABP) #
    #######################################
    # ABP hardcodes the DevAddr as well as the security keys in the device

    # Device Address - 32 bit device address (non-unique). Dynamically generated in OTA. Fixed in ABP.
    dev_addr = forms.CharField(max_length=8, min_length=8, required=False, label="Device Address",
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal")],
                               widget=forms.TextInput(
                                   attrs={'class': 'mdl-textfield__input', 'pattern': '[0-9A-Fa-f]{8}',
                                          'placeholder': '8 hex characters', 'title': '8 hex characters'}),
                               help_text="The device address is used to identify a device. 8 bit device address "
                                         "represented by a 8-character hexadecimal string.")
    # Network Session Key - used for interaction between the node and the network.
    # This key is used to check the validity of messages
    # Is also used to map a non-unique device address (DevAddr) to a unique DevEUI and AppEUI.
    nwkskey = forms.CharField(max_length=32, min_length=32, required=False, label="Network Session Key",
                              validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal")],
                              widget=forms.TextInput(
                                  attrs={'class': 'mdl-textfield__input', 'pattern': '[0-9A-Fa-f]{32}',
                                         'placeholder': '32 hex characters', 'title': '32 hex characters'}),
                              help_text="The Network Session key is used to ensure security at network level - "
                                        "from device to the network. The key is 128 bits in length represented by a "
                                        "32-character hexadecimal string.")

    # Application Session Key - used for encryption and decryption of the payload
    appskey = forms.CharField(max_length=32, min_length=32, required=False, label="Application Session Key",
                              validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal")],
                              widget=forms.TextInput(
                                  attrs={'class': 'mdl-textfield__input', 'pattern': '[0-9A-Fa-f]{32}',
                                         'placeholder': '32 hex characters', 'title': '32 hex characters'}),
                              help_text="The Application Session key is used to ensure end to end security from the "
                                        "device to the data server. The key is 128 bits in length represented by a "
                                        "32-character hexadecimal string.")
    # appskey and nwkskey are unique per device, per session. In OTAA these keys are re-generated on every activation.
    # In ABP these keys stay the same until you change them.

    ##################################
    # Over the Air Activation (OTAA) #
    ##################################
    # Devices perform a join-procedure with the network, during which a dynamic DevAddr is assigned and security keys
    # are negotiated with the device.

    # Application Key -  used to derive the two session keys (appskey nwkskey) and during the activation procedure.
    app_key = forms.CharField(max_length=32, min_length=32, required=False, label="Application key",
                              validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal")],
                              widget=forms.TextInput(
                                  attrs={'class': 'mdl-textfield__input', 'pattern': '[0-9A-Fa-f]{32}',
                                         'placeholder': '32 hex characters', 'title': '32 hex characters'}),
                              help_text="The application key is used to derive the two session keys during the "
                                        "activation procedure. The key is 128 bits in length represented by a "
                                        "32-character hexadecimal string.")

    def _post_clean(self):
        if 'activation_type' in self.cleaned_data and self.cleaned_data['activation_type'] == "otaa":
            self.cleaned_data.pop('dev_addr', None)
            self.cleaned_data.pop('nwkskey', None)
            self.cleaned_data.pop('appskey', None)
        elif 'activation_type' in self.cleaned_data and self.cleaned_data['activation_type'] == "abp":
            self.cleaned_data.pop('app_key', None)
        else:
            self.add_error(None, ValidationError("Activation type not supported"))


class LWHTTPConnection(forms.Form):
    """Form used to process Everynet LoRaWAN HTTP Connections"""
    name = forms.CharField(max_length=150, widget=mdl_textfield_widget)
    description = forms.CharField(max_length=255, widget=mdl_textfield_widget, required=False)
    url = forms.URLField(widget=mdl_textfield_widget, help_text="URL where to send the data")
    auth_heather = forms.CharField(max_length=255, required=False, widget=mdl_textfield_widget,
                                   label="Authorisation Header", help_text="Authorisation header that will be used"
                                                                           "when sending requests to the URL.")


class LWHTTPConnectionConfirmation(forms.Form):
    """Form used to process Everynet LoRaWAN HTTP Connections confirmations after they have been entered in the
    Everynet panel"""
    connection_id = forms.CharField(max_length=24, min_length=24, label="Connection ID",
                                    validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal")],
                                    widget=forms.TextInput(
                                       attrs={'class': 'mdl-textfield__input', 'pattern': '[0-9A-Fa-f]{24}',
                                              'placeholder': '24 hex characters', 'title': '24 hex characters'}),
                                    help_text="Enter the Connection ID from the new Connection you have created in the "
                                              "Everynet panel. This is represented by a 24-character hexadecimal "
                                              "string.")


class DeviceMultipleChoiceField(forms.ModelMultipleChoiceField):
    def __init__(self, user, **kwargs):
        super().__init__(queryset=Sensor.get_all_lorawan(user_id=user.id),
                         label="Devices you own", widget=forms.SelectMultiple(attrs={'class': 'mdl-textfield__input'}),
                         **kwargs)

    def label_from_instance(self, obj):
        return "%s" % obj.info['name'] if 'name' in obj.info else 'LoRaWAN Device #%d' % obj.id


class LWHTTPConnectionDevicesForm(forms.Form):
    """Form used to associate which Sensor data (from the list of sensors selected) should be send via the Connection.
    This is done via an Everynet filter."""

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user')
        super(LWHTTPConnectionDevicesForm, self).__init__(*args, **kwargs)
        self.fields['devices'] = DeviceMultipleChoiceField(user=self.user, required=False)
