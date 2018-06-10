from django.contrib.gis.forms import OSMWidget
from django import forms
from django.forms import ModelForm, TextInput, Select
from smartpanel.models import Display, Layout


class LayoutChoiceField(forms.ModelChoiceField):
    def __init__(self, user, **kwargs):
        super().__init__(queryset=Layout.objects.filter(owner=user),
                         label="Layout", widget=forms.Select(attrs={'class': 'mdl-textfield__input'}), **kwargs)

    def label_from_instance(self, obj):
        return obj.name


class DisplayForm(ModelForm):
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user')
        super(DisplayForm, self).__init__(*args, **kwargs)
        self.fields['layout'] = LayoutChoiceField(user=user)

    class Meta:
        model = Display
        fields = ['name', 'layout', 'location']
        widgets = {
            'name': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'location': OSMWidget(attrs={'map_width': 800, 'map_height': 500,
                                         'default_lat': 52.205, 'default_lon': 0.119}),
        }
        labels = {
            'location': "Location (click or drag to set the location of the display)"
        }
