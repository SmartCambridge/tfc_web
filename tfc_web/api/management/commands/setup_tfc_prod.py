from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.utils import IntegrityError

from allauth.account.models import EmailAddress

from authmultitoken.models import Token
from smartcambridge.models import SmartCambridgeUser

UserModel = get_user_model()


class Command(BaseCommand):

    '''
    Confirm that a 'tfc_prod' Django user exist, and create one using
    TFC_PROD_* config information otherwise. Make sure the corresponding
    email address is marked as verified, and ensure the user is marked
    as having agreed to the Terms and Conditions.

    Add API tokens to this user based on information from the SYSTEM_API_TOKENS
    config item.
    '''

    help = 'Setup the tfc_prod user with access to the API'

    def handle(self, *args, **options):

        # Retrieve or create the user
        try:
            tfc_prod_user = UserModel._default_manager.get_by_natural_key(
                settings.TFC_PROD_USERNAME)
            self.stdout.write('{0} user exists'.format(settings.TFC_PROD_USERNAME))
        except (UserModel.DoesNotExist):
            tfc_prod_user = UserModel._default_manager.create_superuser(
                settings.TFC_PROD_USERNAME,
                settings.TFC_PROD_EMAIL,
                settings.TFC_PROD_PASSWORD
            )
            self.stdout.write('{0} user added'.format(settings.TFC_PROD_USERNAME))

        # Make sure the email address is marked as verified
        address = EmailAddress.objects.add_email(
            None,
            tfc_prod_user,
            settings.TFC_PROD_EMAIL,
            confirm=False
        )
        address.set_as_primary()
        address.verified = True
        address.save()

        # MAke sure the account is marked as having accepted the TCs
        SmartCambridgeUser.accept_tcs(
            tfc_prod_user,
            account_type='business',
            company_name=settings.TFC_PROD_USERNAME,
            company_email=settings.TFC_PROD_EMAIL
        )

        # Set up the API tokens
        for key, value in settings.SYSTEM_API_TOKENS.items():
            self.maybe_create(
                tfc_prod_user,
                key,
                value['digest'],
                value['restrictions']
            )

    def maybe_create(self, user, name, digest, restrictions):

        token, created = Token.objects.get_or_create(user=user, name=name)
        token.digest = digest
        token.save()
        if created:
            self.stdout.write('{0} token created'.format(name))
        else:
            self.stdout.write('{0} token exists'.format(name))

        for restriction in restrictions:
            try:
                token.referers.create(value=restriction)
                self.stdout.write('  restriction {0} added'.format(restriction))
            except IntegrityError:
                self.stdout.write('  restriction {0} exists'.format(restriction))
