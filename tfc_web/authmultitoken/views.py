import logging

from django import forms
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models.functions import Lower
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.template.defaultfilters import pluralize
from django.urls import reverse

from rest_framework import parsers, renderers
from rest_framework.compat import coreapi, coreschema
from rest_framework.response import Response
from rest_framework.schemas import ManualSchema
from rest_framework.views import APIView

from .models import Token, Referer
from .serializers import AuthTokenSerializer


logger = logging.getLogger(__name__)


@login_required
def manage_tokens(request):
    if request.method == 'POST':
        tokens = Token.objects.filter(
            user=request.user,
            id__in=request.POST.getlist('items')
        )
        if tokens:
            n_tokens = len(tokens)
            tokens.delete()
            messages.add_message(
                request, messages.SUCCESS,
                'Deleted {0} token{1}'.format(n_tokens, pluralize(n_tokens))
            )
        return HttpResponseRedirect(reverse('manage_tokens'))
    else:
        tokens = Token.objects.filter(user=request.user).order_by(Lower('name').desc())
        logger.info("Tokens found: %s", tokens)
        return render(
            request,
            'authmultitoken/token_list.html', {'token_list': tokens}
        )


class TokenForm(forms.Form):
    name = forms.CharField(label='Token name', max_length=64)

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super(TokenForm, self).__init__(*args, **kwargs)

    def clean_name(self):
        user = self.user
        name = self.cleaned_data['name']
        tokens = Token.objects.filter(user=user, name=name)
        if len(tokens) > 0:
            raise forms.ValidationError(
                'You already have a token called \'{name}\''.format(name=name)
            )
        return name


@login_required
def create_token(request):
    if request.method == 'POST':
        form = TokenForm(request.POST, user=request.user)
        if form.is_valid():
            token = Token.objects.new_token(
                user=request.user,
                name=form.cleaned_data['name']
            )
            return render(
                request,
                'authmultitoken/token_created.html',
                {'token': token, 'name': form.cleaned_data['name']}
            )
    else:
        form = TokenForm()
    return render(request, 'authmultitoken/new_token.html', {'form': form})


class RestrictionForm(forms.Form):
    value = forms.CharField(label='Restriction', max_length=256)


@login_required
def manage_token(request, token_id):
    if request.method == 'POST':
        referers = Referer.objects.filter(
            token__user=request.user,
            id__in=request.POST.getlist('items')
        )
        if referers:
            n_referers = len(referers)
            referers.delete()
            messages.add_message(
                request, messages.SUCCESS,
                'Deleted {0} restrictions{1}'.format(n_referers, pluralize(n_referers))
            )
        return HttpResponseRedirect(reverse('manage_token', args=[token_id]))
    else:
        token = Token.objects.get(
            user=request.user,
            id=token_id)
        logger.info("Token found %s with referers: %s", token_id, token.referers)
        return render(
            request,
            'authmultitoken/token_management.html',
            {'token': token,
             'referers': token.referers.all().order_by('id'),
             'form': RestrictionForm(),
             }
        )


@login_required
def add_restriction(request, token_id):
    if request.method == 'POST':
        form = RestrictionForm(request.POST)
        if form.is_valid():
            token = Token.objects.get(
                user=request.user,
                id=token_id)
            token.referers.create(
                value=form.cleaned_data['value'])
            return HttpResponseRedirect(reverse('manage_token', args=[token_id]))


class ObtainAuthToken(APIView):
    throttle_classes = ()
    permission_classes = ()
    parser_classes = (
        parsers.FormParser,
        parsers.MultiPartParser,
        parsers.JSONParser,)
    renderer_classes = (renderers.JSONRenderer,)
    serializer_class = AuthTokenSerializer
    if coreapi is not None and coreschema is not None:
        schema = ManualSchema(
            fields=[
                coreapi.Field(
                    name="username",
                    required=True,
                    location='form',
                    schema=coreschema.String(
                        title="Username",
                        description="Valid username for authentication",
                    ),
                ),
                coreapi.Field(
                    name="password",
                    required=True,
                    location='form',
                    schema=coreschema.String(
                        title="Password",
                        description="Valid password for authentication",
                    ),
                ),
                coreapi.Field(
                    name="name",
                    required=True,
                    location='form',
                    schema=coreschema.String(
                        title="name",
                        description="Name or description of this token",
                    ),
                ),
            ]
        )

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        name = serializer.validated_data['name']
        token = Token.objects.new_token(user=user, name=name)
        return Response({'token': token})


obtain_auth_token = ObtainAuthToken.as_view()
