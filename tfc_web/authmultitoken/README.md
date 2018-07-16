MultiTokenAuthentication
========================

A [Django Rest Framework](http://www.django-rest-framework.org/) (DRF)
[Authentication class](http://www.django-rest-framework.org/api-guide/authentication/)
supporting a token-based authentication scheme in which individual users can
have multiple tokens. This is similar to (and based on) DRF's TokenAuthentication
but with the following differences:

* Support for multiple tokens per user
* Tokens are stored hashed to reduce the ridk of compromise
* An HTML interface through which users can manage
  their own tokens

Using MultiTokenAuth
--------------------

To use the `MultiTokenAuthentication` scheme you'll need to
[configure the authentication classes](http://www.django-rest-framework.org/api-guide/authentication/#setting-the-authentication-scheme) to include `MultiTokenAuthentication`,
and additionally include authmultitoken in your INSTALLED_APPS setting:

```
INSTALLED_APPS = (
    ...
    'authmultitoken'
)
```

Run `manage.py migrate` after changing your settings -
the authmultitoken app provides Django database migrations.

There are various ways to create tokens (see below). For testing, the simplest is to use:

```
manage.py create_multitoken <userid> <name for token>
```

For clients to authenticate, the token key should be included in the `Authorization`
HTTP header. The key should be prefixed by the string literal "Token", with whitespace
separating the two strings. For example:

```
Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b
```

If you want to use a different keyword in the header, such as `Bearer`,
subclass `MultiTokenAuthentication` and set the `keyword` class variable.

If successfully authenticated, `MultiTokenAuthentication` provides the following
credentials.

* `request.user` will be a Django `User` instance.
* `request.auth` will be a `authmultitoken.models.Token` instance.

The Token model includes an `is_active` flag which defaults to `True`. Authentication will only succeed for tokens and corresponding users for which `is_active` is `True`.

Unauthenticated responses that are denied permission will result in an
`HTTP 401 Unauthorized` response with an appropriate WWW-Authenticate header.
For example:

```
WWW-Authenticate: Token
```

The curl command line tool may be useful for testing token authenticated APIs. For example:

```
curl -X GET http://127.0.0.1:8000/api/example/ -H 'Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b'
```

If you use `MultiTokenAuthentication` in production you should ensure
that your API is only available over `https`.

Generating and managing tokens
------------------------------

Unlike DRF's `TokenAuthentication`, `MultiTokenAuthentication` only stores
a hashed copies of tokens and so can only display the token value immediately
after creation. If this value is lost the token becomes useless. It can however be
easily deleted and re-created.

### By administrators using mange.py

Tokens can be generated with:

```
manage.py create_multitoken <userid> <name for token>
```

listed with:

```
manage.py list_multitoken <userid>
```

and deleted with:

```
delete_multitoken <userid> <name for token>
```

### By administrators using Django admin

Tokens can be listed, manipulated, and deleted using Django Admin. It is not
currently possible to create tokens.

### By users interactively

Include `authmultitoken.html_urls` somewhere in your URL resolver
configuration, e.g.

```
urlpatterns += [
    url(r'', include('authmultitoken.html_urls')),
]
```

This exposes a `create-token/` endpoint for creating new tokens and a
`tokens/` endpoint for listing and deleting them. Both endpoints
require Django session authentication and will trigger authentication
as necessary.

### By users, programmaticly

Include `authmultitoken.endpoint_urls` somewhere in your URL resolver
configuration, e.g.

```
urlpatterns += [
    url(r'', include('authmultitoken.endpoint_urls')),
]
```

This exposes a  `api-token-auth/` endpoint that will return a token
in a JSON response when valid username, password and token name fields are
POSTed to it (as form data or JSON):

```
{ 'token' : '9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b' }
```

By default there are no permissions or throttling applied to this endpoint.
If you do wish to apply throttling you'll need
to override the the `ObtainAuthToken` view class, and include it using the throttle_classes
attribute.

If you need a customized version of this endpoint you can create one
by subclassing the `ObtainAuthToken` view class, and using that in
your url conf instead.

### By administrators, programmaticly

Tokens can be created programmaticly:

```
from authmultitoken.models import Token

token = Token.objects.create(user=user, name=tokenname)
print(token)
```

Note that `.create` returns the token value as a string, not the created
token object. See
[DRF's TokenAuth documentation](http://www.django-rest-framework.org/api-guide/authentication/#tokenauthentication)
for possible applications.