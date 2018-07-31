from uuid import uuid4

import random
import string

from django.contrib.auth.models import User
from django.contrib.gis.db.models import PointField, DO_NOTHING
from django.contrib.postgres.fields import JSONField
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.encoding import python_2_unicode_compatible


class Layout(models.Model):
    name = models.CharField(max_length=100)
    design = JSONField()
    configuration = JSONField(null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=DO_NOTHING)
    version = models.IntegerField(default=1)
    version_date = models.DateTimeField(auto_now_add=True)
    slug = models.SlugField(max_length=12, unique=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            slug = str(uuid4())[24:]
            while Layout.objects.filter(slug=slug):
                slug = str(uuid4())[24:]
            self.slug = slug
        super(Layout, self).save(*args, **kwargs)

    @python_2_unicode_compatible
    def __str__(self):
        return self.name


class Display(models.Model):
    name = models.CharField(max_length=100)
    location = PointField(null=True)
    layout = models.ForeignKey(Layout, null=True, related_name="displays", on_delete=DO_NOTHING)
    owner = models.ForeignKey(User, on_delete=DO_NOTHING)
    slug = models.SlugField(max_length=12, unique=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            # slug = str(uuid4())[24:]
            # while Display.objects.filter(slug=slug):
            #    slug = str(uuid4())[24:]
            # generate a unique display slug ABCD-1234
            slug = ''
            while True:
                slug = (''.join(random.choice(string.ascii_uppercase) for _ in range(4))+
                        '-'+
                        ''.join(random.choice(string.digits) for _ in range(4)))
                if not Display.objects.filter(slug=slug):
                    break
            self.slug = slug
        super(Display, self).save(*args, **kwargs)

    @python_2_unicode_compatible
    def __str__(self):
        return self.name


class SmartPanelUser(models.Model):
    user = models.OneToOneField(User, related_name="smartpanel_user", on_delete=models.CASCADE, primary_key=True)
    accepted_tcs = models.BooleanField(default=False, null=False)
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
            SmartPanelUser.objects.create(user=instance)

    @classmethod
    def accept_tcs(cls, user, account_type='personal', company_name=None, company_email=None):
        smartpanel_user = SmartPanelUser.objects.filter(user=user)
        if smartpanel_user:
            smartpanel_user = smartpanel_user[0]
            smartpanel_user.accepted_tcs = True
            smartpanel_user.account_type = account_type
            smartpanel_user.company_name = company_name
            smartpanel_user.company_email = company_email
            smartpanel_user.save()
        else:
            SmartPanelUser.objects.create(user=user, accepted_tcs=True, account_type=account_type,
                                          company_name=company_name, company_email=company_email)
