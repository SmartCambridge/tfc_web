from django.contrib import admin

from .models import Token


class TokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'created', 'is_active')
    fields = ('user', 'name', 'is_active')
    ordering = ('-created',)

    def has_add_permission(self, request):
        ''' Disable the 'Add' button since it won't work '''
        return False


admin.site.register(Token, TokenAdmin)
