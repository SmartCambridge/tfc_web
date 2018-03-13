from django import template


register = template.Library()


@register.filter
def remove_underscore(string):
    return string.replace('_', '')
