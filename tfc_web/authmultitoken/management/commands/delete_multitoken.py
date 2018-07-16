from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from authmultitoken.models import Token

UserModel = get_user_model()


class Command(BaseCommand):
    help = 'Delete a given MultiToken for a given user'

    def get_user_token(self, username, tokenname):
        user = UserModel._default_manager.get_by_natural_key(username)
        return Token.objects.get(user=user, name=tokenname)

    def add_arguments(self, parser):
        parser.add_argument('username', type=str)
        parser.add_argument('tokenname', type=str)

    def handle(self, *args, **options):
        username = options['username']
        tokenname = options['tokenname']

        try:
            token = self.get_user_token(username, tokenname)
            token.delete()
        except (UserModel.DoesNotExist, Token.DoesNotExist):
            raise CommandError(
                'Cannot delete the Token: '
                'token \'{1}\' for user {0} does not exist'.format(
                    username,
                    tokenname)
            )
        self.stdout.write(
            'Token for user {0} with name \'{1}\' deleted'.format(
                username,
                tokenname))
