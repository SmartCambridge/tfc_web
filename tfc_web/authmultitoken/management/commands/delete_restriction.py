from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from authmultitoken.models import Referer

UserModel = get_user_model()


class Command(BaseCommand):
    help = 'Delete a restriction on a given MultiToken for a given user'

    def get_referers(self, username, tokenname, restriction):
        user = UserModel._default_manager.get_by_natural_key(username)
        return Referer.objects.filter(token__user=user, token__name=tokenname,
                                      value=restriction)

    def add_arguments(self, parser):
        parser.add_argument('username', type=str)
        parser.add_argument('tokenname', type=str)
        parser.add_argument('restriction', type=str)

    def handle(self, *args, **options):
        username = options['username']
        tokenname = options['tokenname']
        restriction = options['restriction']

        referers = self.get_referers(username, tokenname, restriction)
        if referers:
            referers.delete()
            self.stdout.write(
                'Restriction \'{2}\' on token with name \'{1}\' for user {0} deleted'.format(
                    username,
                    tokenname,
                    restriction))
        else:
            raise CommandError(
                'Cannot delete the restriction: '
                'restriction \'{2}\' on token \'{1}\' for user {0} does not exist'.format(
                    username,
                    tokenname,
                    restriction))
