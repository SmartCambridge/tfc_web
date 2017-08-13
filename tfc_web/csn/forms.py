from django.core.exceptions import ValidationError
from django.forms import ModelForm, ModelChoiceField, Select, TextInput
from csn.models import LWApplication, LWDevice


class LWDeviceForm(ModelForm):
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user')
        super(LWDeviceForm, self).__init__(*args, **kwargs)
        self.fields['lw_application'] = ModelChoiceField(queryset=LWApplication.objects.filter(user=self.user),
                                                         label="Destination",
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
        if commit:
            lw_device.save()
        return lw_device

    class Meta:
        model = LWDevice
        fields = ['name', 'description', 'dev_class', 'counters_size', 'dev_eui', 'lw_application']
        labels = {
            'dev_class': "Device Class",
            'dev_eui': "Device EUI",
        }
        widgets = {
            'name': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'description': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'dev_class': Select(attrs={'class': 'mdl-textfield__input'}),
            'counters_size': Select(attrs={'class': 'mdl-textfield__input'}),
            'dev_eui': TextInput(attrs={'class': 'mdl-textfield__input', 'pattern': '[0-9A-Fa-f]{16}',
                                        'placeholder': '16 hex characters', 'title': '16 hex characters'}),
        }

class LWApplicationForm(ModelForm):
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user')
        super(LWApplicationForm, self).__init__(*args, **kwargs)

    def clean(self):
        cleaned_data = super(LWApplicationForm, self).clean()
        cleaned_data['user'] = self.user
        return cleaned_data

    def save(self, commit=True):
        lw_device = super(LWApplicationForm, self).save(commit=False)
        lw_device.user = self.user
        if commit:
            lw_device.save()
        return lw_device

    class Meta:
        model = LWApplication
        fields = ['name', 'description', 'url', 'token']
        widgets = {
            'name': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'description': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'url': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'token': TextInput(attrs={'class': 'mdl-textfield__input'}),
        }
