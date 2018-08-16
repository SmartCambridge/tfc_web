from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.timezone import now


class SmartCambridgeUser(models.Model):
    user = models.OneToOneField(User, related_name="smartcambridge_user", on_delete=models.CASCADE, primary_key=True)
    accepted_tcs = models.BooleanField(default=False, null=False)
    accepted_tcs_datetime = models.DateTimeField(null=True, blank=True)
    ACCOUNT_TYPE_CHOICE = (
        ('personal', 'Personal'),
        ('business', 'Business'),
    )
    account_type = models.CharField(choices=ACCOUNT_TYPE_CHOICE, max_length=20)
    company_name = models.CharField(null=True, blank=True, max_length=200)
    company_email = models.EmailField(null=True, blank=True)


    @receiver(post_save, sender=User)
    def create_user_profile(sender, instance, created, **kwargs):
        if created:
            SmartCambridgeUser.objects.create(user=instance)

    @classmethod
    def accept_tcs(cls, user, account_type='personal', company_name=None, company_email=None):
        smartcambridge_user = SmartCambridgeUser.objects.filter(user=user)
        if smartcambridge_user:
            smartcambridge_user = smartcambridge_user[0]
            if smartcambridge_user.accepted_tcs:
                return
            smartcambridge_user.accepted_tcs = True
            smartcambridge_user.accepted_tcs_datetime = now()
            smartcambridge_user.account_type = account_type
            smartcambridge_user.company_name = company_name
            smartcambridge_user.company_email = company_email
            smartcambridge_user.save()
        else:
            SmartCambridgeUser.objects.create(user=user, accepted_tcs=True, accepted_tcs_datetime=now(),
                                              account_type=account_type, company_name=company_name,
                                              company_email=company_email)
