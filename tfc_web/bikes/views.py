from django.shortcuts import render

from bikes.models import Bike


def current_bikes(request):
    bikes = Bike.objects.order_by('bike_id', '-timestamp').distinct('bike_id')
    return render(request, 'bikes/current-bikes.html', {'bikes': bikes})
