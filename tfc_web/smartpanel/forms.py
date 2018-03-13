from django.contrib.gis.forms import OSMWidget
from django.forms import ModelForm, TextInput, Select
from smartpanel.models import Screen


class ScreenForm(ModelForm):
    class Meta:
        model = Screen
        fields = ['name', 'layout', 'location']
        widgets = {
            'name': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'layout': Select(attrs={'class': 'mdl-textfield__input'}),
            'location': OSMWidget(attrs={'map_width': 800, 'map_height': 500,
                                         'default_lat': 52.205, 'default_lon': 0.119}),
        }
