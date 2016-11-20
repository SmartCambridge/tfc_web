from urllib.parse import urljoin

from django import template
from django.conf import settings
from django.templatetags.static import StaticNode, PrefixNode

register = template.Library()


class NewStaticNode(StaticNode):
    @classmethod
    def handle_simple(cls, path):
        return settings.STATIC_URL_PREFIX + urljoin(PrefixNode.handle_simple("STATIC_URL"), path)


@register.tag('static')
def static(parser, token):
    """Temporal workaround for static template tag to support SCRIPT_NAME """
    return NewStaticNode.handle_token(parser, token)
