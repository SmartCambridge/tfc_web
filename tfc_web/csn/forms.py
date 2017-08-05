from django.core.exceptions import ValidationError
from django.forms import ModelForm, ModelChoiceField, Select, TextInput
from csn.models import LWApplication, LWDevice


class LWDeviceForm(ModelForm):
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user')
        super(LWDeviceForm, self).__init__(*args, **kwargs)
        self.fields['lw_application'] = ModelChoiceField(queryset=LWApplication.objects.filter(user_id=self.user.pk),
                                                         widget=Select(attrs={'class': 'mdl-textfield__input'}))

    def clean(self):
        cleaned_data = super(LWDeviceForm, self).clean()
        lw_application = cleaned_data.get("lw_application")
        if self.user != lw_application.user:
            raise ValidationError("You are not authorise to add this device to the application selected")
        cleaned_data['user'] = self.user
        return cleaned_data

    def save(self, commit=True):
        lw_device = super(LWDeviceForm, self).save(commit=False)
        lw_device.user = self.user
        lw_device.save()
        return lw_device

    class Meta:
        model = LWDevice
        fields = ['name', 'description', 'dev_eui', 'dev_class', 'counters_size', 'dev_addr', 'nwkskey',
                  'lw_application']
        labels = {
            'dev_class': "Device Class",
            'dev_eui': "Device EUI (16 HEX)",
            'dev_addr': "Device Address (8 HEX)",
            'nwkskey': "Network session key (32 HEX)",
            'lw_application': "Application",
        }
        widgets = {
            'dev_eui': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'name': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'description': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'dev_class': Select(attrs={'class': 'mdl-textfield__input'}),
            'counters_size': Select(attrs={'class': 'mdl-textfield__input'}),
            'dev_addr': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'nwkskey': TextInput(attrs={'class': 'mdl-textfield__input'}),
        }


class LWApplicationForm(ModelForm):
    class Meta:
        model = LWApplication
        fields = ['name', 'description', 'url']
        widgets = {
            'name': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'description': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'url': TextInput(attrs={'class': 'mdl-textfield__input'}),
        }
