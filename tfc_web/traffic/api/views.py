from datetime import timedelta
import logging
import os

from rest_framework.response import Response
from rest_framework.exceptions import NotFound
from rest_framework.schemas import AutoSchema

from .serializers import (
    ZoneListSerializer, ZoneConfigSerializer, ZoneHistorySerializer,
    BTJourneySiteSerializer, BTJourneySiteListSerializer,
    BTJourneyLinkOrRouteSerializer,
    BTJourneyLinkListSerializer, BTJourneyRouteListSerializer,
    BTJourneyLinkRecordSerializer, BTJourneyLinkRecordListSerializer)
from api import util, auth, api_docs


logger = logging.getLogger(__name__)


# # Zones

def get_zone_config(zone_id=None):
    if zone_id is None:
        return util.get_config('zone')
    else:
        try:
            return util.get_config('zone', zone_id,
                                   'zone_list', 'zone.id')
        except (util.TFCValidationError) as e:
            raise NotFound("Zone not found: {0}".format(e))


def swap_dot_and_underscore(data):
    ''' serializer can't cope with '.' in keys - switch to '_' '''
    return {key.replace('.', '_'): value for (key, value) in data.items()}


class ZoneList(auth.AuthenticateddAPIView):
    '''
    List metadata for all known zones, including each zone's
    _zone_id_.
    '''
    def get(self, request):
        data = get_zone_config()
        # serializer can't cope with '.' in keys - switch to '_'
        fixed_zones = []
        for zone in data['zone_list']:
            fixed_zone = swap_dot_and_underscore(zone)
            fixed_zones.append(fixed_zone)
        serializer = ZoneListSerializer({"zone_list": fixed_zones})
        return Response(serializer.data)


class ZoneConfig(auth.AuthenticateddAPIView):
    '''
    Return the metadata for a single zone identified by _zone_id_.
    '''
    schema = AutoSchema(manual_fields=api_docs.zone_id_fields)

    def get(self, request, zone_id):
        data = get_zone_config(zone_id)
        serializer = ZoneConfigSerializer(swap_dot_and_underscore(data))
        return Response(serializer.data)


class ZoneHistory(auth.AuthenticateddAPIView):
    '''
    Return historic zone data for the single zone identified by _zone_id_.
    Data is returned in 24-hour chunks from _start_date_ to _end_date_
    inclusive. A most 31 day's data can be retrieved in a single request.
    '''
    schema = AutoSchema(manual_fields=api_docs.zone_id_fields+api_docs.list_args_fields)

    def get(self, request, zone_id):

        args = util.ListArgsSerializer(data=request.query_params)
        args.is_valid(raise_exception=True)

        # Note that this validates zone_id!
        get_zone_config(zone_id)

        start_date = args.validated_data.get('start_date')
        end_date = args.validated_data.get('end_date')
        if end_date is None:
            end_date = start_date
        day_count = (end_date - start_date).days + 1

        results = []
        for date in (start_date + timedelta(n) for n in range(day_count)):
            try:
                filename = (
                    'cloudamber/sirivm/data_zone/'
                    '{1:%Y}/{1:%m}/{1:%d}/{0}_{1:%Y-%m-%d}.txt'
                    .format(zone_id, date)
                    )
                results = results + util.read_json_fragments(filename)
            except (FileNotFoundError):
                pass
        serializer = ZoneHistorySerializer({'request_data': results})
        return Response(serializer.data)


# # BTJourney

def bt_list_configs(which):
    '''
    Return a definitive list of the links, routes or sites for which location data exists
    '''
    results = []
    path = util.safe_build('btjourney/locations/data_{0}/'.format(which))
    for file in os.listdir(path):
        if os.path.isfile(os.path.join(path, file)) and file.endswith('.json'):
            results.append(file[:-5])
    return results


def bt_read_config(which, id):
    '''
    Return the link, route or site config for id
    '''
    filename = 'btjourney/locations/data_{0}/{1}.json'.format(which, id)
    return util.read_json(filename)


def bt_get_config(which, id=None):
    '''
    Return link, route or site configs, either for id if provided, or for
    everything
    '''
    configs = bt_list_configs(which)

    if id is None:
        results = []
        for config in configs:
            results.append(bt_read_config(which, config))
        return results

    else:
        if id in configs:
            return bt_read_config(which, id)
        else:
            raise NotFound("{0} id '{1}' not found".format(which, id))


def bt_read_latest():
    '''
    Read the current data monitor file
    '''
    filename = 'btjourney/journeytimes/data_monitor_json/post_data.json'
    return util.read_json(filename)


class BTJourneyLinkList(auth.AuthenticateddAPIView):
    '''
    List metadata for all known links.
    '''
    def get(self, request):
        data = bt_get_config('link')
        serializer = BTJourneyLinkListSerializer({'link_list': data})
        return Response(serializer.data)


class BTJourneyRouteList(auth.AuthenticateddAPIView):
    '''
    List metadata for all known routes.
    '''
    def get(self, request):
        data = bt_get_config('route')
        serializer = BTJourneyRouteListSerializer({'route_list': data})
        return Response(serializer.data)


class BTJourneyLinkOrRouteConfig(auth.AuthenticateddAPIView):
    '''
    Return the metadata for a single link or route identified by _id_.
    '''
    schema = AutoSchema(manual_fields=api_docs.link_or_route_id_fields)

    def get(self, request, id):
        try:
            data = bt_get_config('link', id)
        except NotFound:
            try:
                data = bt_get_config('route', id)
            except NotFound:
                raise NotFound("Link or route id '{0}' not found".format(id))
        serializer = BTJourneyLinkOrRouteSerializer(data)
        return Response(serializer.data)


class BTJourneySiteList(auth.AuthenticateddAPIView):
    '''
    List metadata for all known sites.
    '''
    def get(self, request):
        data = bt_get_config('site')
        serializer = BTJourneySiteListSerializer({'site_list': data})
        return Response(serializer.data)


class BTJourneySiteConfig(auth.AuthenticateddAPIView):
    '''
    Return the metadata for a single site identified by _site_id_.
    '''
    schema = AutoSchema(manual_fields=api_docs.site_id_fields)

    def get(self, request, site_id):
        data = bt_get_config('site', site_id)
        serializer = BTJourneySiteSerializer(data)
        return Response(serializer.data)


class BTJourneyLinkHistory(auth.AuthenticateddAPIView):
    '''
    Return historic journey time data for the link or route identified by _id_.
    Data is returned in 24-hour chunks from _start_date_ to _end_date_
    inclusive. At most 31 day's data can be retrieved in a single request.
    '''
    schema = AutoSchema(manual_fields=api_docs.link_or_route_id_fields + api_docs.list_args_fields)

    def get(self, request, id):

        args = util.ListArgsSerializer(data=request.query_params)
        args.is_valid(raise_exception=True)

        if id not in bt_list_configs('link') and id not in bt_list_configs('route'):
            raise NotFound("Link with id '{0}' not found".format(id))

        start_date = args.validated_data.get('start_date')
        end_date = args.validated_data.get('end_date')
        if end_date is None:
            end_date = start_date
        day_count = (end_date - start_date).days + 1

        results = []
        for date in (start_date + timedelta(n) for n in range(day_count)):
            try:
                filename = (
                    'btjourney/journeytimes/data_link/{1:%Y}/{1:%m}/{1:%d}/{0}_{1:%Y-%m-%d}.txt'
                    .format(id, date)
                    )
                results = results + util.read_json_fragments(filename)
            except FileNotFoundError:
                pass
        serializer = BTJourneyLinkRecordListSerializer({'request_data': results})
        return Response(serializer.data)


class BTJourneyLinkLatestList(auth.AuthenticateddAPIView):
    '''
    Return most recent journey times for all links and routes.
    '''

    def get(self, request):

        # # FIXME: update when the format of post_data.json changes

        data = bt_read_latest()
        serializer = BTJourneyLinkRecordListSerializer(data)
        return Response(serializer.data)


class BTJourneyLinkLatest(auth.AuthenticateddAPIView):
    '''
    Return most recent journey time data for the link or route
    identified by _id_.
    '''
    schema = AutoSchema(manual_fields=api_docs.link_or_route_id_fields)

    def get(self, request, id):

        # # FIXME: update when the format of post_data.json changes

        data = bt_read_latest()

        for value in data['request_data']:
            if value['id'] == id:
                value['ts'] = data['ts']
                serializer = BTJourneyLinkRecordSerializer(value)
                return Response(serializer.data)
        raise NotFound("No data found for link '{0}'".format(id))
