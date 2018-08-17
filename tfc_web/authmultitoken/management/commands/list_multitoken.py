from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from authmultitoken.models import Token

UserModel = get_user_model()


class Command(BaseCommand):
    help = 'List MultiTokens for a given user'

    def get_user_tokens(self, username):
        user = UserModel._default_manager.get_by_natural_key(username)
        tokens = Token.objects.filter(user=user).order_by('name')
        return tokens

    def add_arguments(self, parser):
        parser.add_argument('username', type=str)

    def handle(self, *args, **options):
        username = options['username']

        try:
            tokens = self.get_user_tokens(username)
        except UserModel.DoesNotExist:
            raise CommandError(
                'Cannot list Tokens: user {0} does not exist'.format(
                    username)
            )
        if len(tokens) == 0:
            print("No tokens for {0}".format(username))
        for token in tokens:
            disabled = '' if token.is_active else ' (DISABLED)'
            print('\'{0}\' created {1:%Y-%m-%d %H:%M:%S}{2}'.format(
                token.name,
                token.created,
                disabled))
            if token.referers:
                print('    Restrictions:')
                for referer in token.referers.all().order_by('id'):
                    print('        {0}'.format(referer.value))
