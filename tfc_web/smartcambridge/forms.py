from allauth.account.forms import SignupForm
from django import forms
from django.core.exceptions import ValidationError


def validate_captcha(value):
    if value != '1992':
        raise ValidationError(
            '%(value)s is not the correct answer',
            params={'value': value},
        )

class CustomSignupForm(SignupForm):
    captcha = forms.CharField(max_length=12, label='Anti-robots question. '
                                                   'Write one thousand nine hundred ninety-two in numbers.',
                              validators=[validate_captcha])
