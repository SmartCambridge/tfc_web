import logging
from urllib.parse import urlparse, parse_qs

from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.http import HttpResponse

from smartcambridge.models import SmartCambridgeUser


logger = logging.getLogger(__name__)


@login_required
def tcs(request):
    smartcambridgeuser = SmartCambridgeUser.objects.filter(user=request.user)
    accepted_tcs = False
    if smartcambridgeuser:
        accepted_tcs = smartcambridgeuser[0].accepted_tcs
    return render(request, 'smartcambridge/tcs.html',
                  {'accepted_tcs': accepted_tcs})


@login_required
def accept_tcs(request):
    if request.method == "POST":
        account_type = request.POST.get('account_type', None)
        company_name = request.POST.get('company_name', None)
        company_email = request.POST.get('company_email', None)
        if account_type == "business" and company_name and company_email:
            SmartCambridgeUser.accept_tcs(request.user, account_type, company_name, company_email)
        elif account_type == "personal":
            SmartCambridgeUser.accept_tcs(request.user, account_type)
        return redirect(parse_qs(urlparse(request.META['HTTP_REFERER']).query).get('next', ['home'])[0])
    return redirect('home')

# Support logging records sent via well known url, i.e.
# /smartcambridge/logger?module_id=pocket&instance_id=KYFU-2348&component_id=stop_timetable&component_ref=0500CCITY432
def smartcambridge_logger(request,module_id,component_id,component_ref):

    # parse fule query string into a dictionary
    qs_string = request.GET.urlencode()
    qs_dict = parse_qs(qs_string)

    # build logger string
    logger_string = '|logger|'+module_id+'|'+component_id+'|'+component_ref+'|'
    for key, values in qs_dict.items():
        logger_string += key+'='+values[0]+'|' # note values is a *list* but we only have singletons

    logger.info(': %s', logger_string)

    # required fields were present so reply "OK, no content"
    return HttpResponse(status=204)

