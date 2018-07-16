from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.utils import IntegrityError

from authmultitoken.models import Token

UserModel = get_user_model()


class Command(BaseCommand):
    help = 'Create a MultiToken for a given user'

    def create_user_token(self, username, tokenname):
        user = UserModel._default_manager.get_by_natural_key(username)
        token = Token.objects.create(user=user, name=tokenname)
        return token

    def add_arguments(self, parser):
        parser.add_argument('username', type=str)
        parser.add_argument('tokenname', type=str)

    def handle(self, *args, **options):
        username = options['username']
        tokenname = options['tokenname']

        try:
            token = self.create_user_token(username, tokenname)
        except UserModel.DoesNotExist:
            raise CommandError(
                'Cannot create the Token: user {0} does not exist'.format(
                    username)
            )
        except IntegrityError:
            raise CommandError(
                'Cannot create the Token: '
                'token name \'{0}\' for user {1} already exists'.format(
                    tokenname, username)
            )
        self.stdout.write(
            'Token {0} created for user {1} with name \'{2}\''.format(
                token,
                username,
                tokenname))
        self.stdout.write(
            'Record this somewhere secure - it won\'t be displayed again')
