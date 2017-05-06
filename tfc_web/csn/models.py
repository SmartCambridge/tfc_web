from django.contrib.auth.models import User
from django.core.validators import RegexValidator, MinLengthValidator
from django.db import models
from django.forms import ModelForm


class LWDevice(models.Model):
    """This class will store LoRaWAN devices"""
    DEVICE_CLASS = (
        ('A', 'A'),
        ('C', 'C'),
    )
    COUNTERS_SIZE_OPTIONS = (
        (2, 2),
        (4, 4),
    )
    dev_class = models.CharField(max_length=1, choices=DEVICE_CLASS)
    counters_size = models.IntegerField(choices=COUNTERS_SIZE_OPTIONS)
    dev_addr = models.CharField(max_length=8,
                                validators=[RegexValidator(r"^[0-9a-fA-F]+$",
                                                           "Should match the ^[0-9a-fA-F]+$ pattern"),
                                            MinLengthValidator(8)])
    nwkskey = models.CharField(max_length=32, validators=[RegexValidator(r"^[0-9a-fA-F]+$",
                                                                          "Should match the ^[0-9a-fA-F]+$ pattern"),
                                                          MinLengthValidator(32)])
    user = models.ForeignKey(User)


class LWDeviceForm(ModelForm):
    class Meta:
        model = LWDevice
        fields = ['dev_class', 'counters_size', 'dev_addr', 'nwkskey']
