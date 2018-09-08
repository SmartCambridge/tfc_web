from django.contrib import admin

from .models import Token, Referer


class RefererInline(admin.TabularInline):
    model = Referer
    list_display = ('token', 'value')
    ordering = ('token', 'value')


class TokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'created', 'is_active')
    fields = ('user', 'name', 'digest', 'is_active')
    ordering = ('user', '-created',)
    inlines = [
        RefererInline
    ]


admin.site.register(Token, TokenAdmin)
