"use strict"
/* JS Socket code to access RTMonitor real-time sirivm data */
//
function RTMonitorAPI() {

    var self = this;

    console.log('RTMonitorAPI V2 instantiation');

    this.RTMONITOR_URI = 'http://tfc-app2.cl.cam.ac.uk/rtmonitor/sirivm';

    // Here we define the 'data record format' of the incoming websocket feed
    this.RECORD_INDEX = 'VehicleRef';  // data record property that is primary key
    this.RECORDS_ARRAY = 'request_data'; // incoming socket data property containing data records
    this.RECORD_TS = 'RecordedAtTime'; // data record property containing timestamp
    this.RECORD_TS_FORMAT = 'ISO8601'; // data record timestamp format
                                       // 'ISO8601' = iso-format string
    this.RECORD_LAT = 'Latitude';      // name of property containing latitude
    this.RECORD_LNG = 'Longitude';     // name of property containing longitude

    this.sock = {}; // the page's WebSocket

    this.sock_timer = {}; // intervalTimer we use for retries iif socket has failed

    this.connect_callbacks = [];

    this.disconnect_callbacks = [];

    this.request_callbacks = {}; // dictionary of request_id -> callback_function for requests and subscriptions

    this.connected = false; // whether the websocket is connected or not

    // listener to detect ESC 'keydown' while in map_only mode to escape back to normal
    document.onkeydown = function(evt) {
        evt = evt || window.event;
        if (evt.keyCode == 27) // ESC to escape from map-only view
        {
            self.disconnect();
            clearInterval(self.progress_timer);
        }
    }; // end onkeydown

    this.init = function()
    {
        self.log('RTMonitorAPI init()');

        self.connect();
    };

// ***************************************************************************
// *******************  WebSocket code    ************************************
// ***************************************************************************
// sock_connect() will be called on startup (i.e. in init())
// It will connect socket, when successful will
// send { 'msg_type': 'rt_connect'} message, and should receive { 'msg_type': 'rt_connect_ok' }, then
// send { 'msg_type': 'rt_subscribe', 'request_id' : 'A' } which subsribes to ALL records.
this.connect = function()
{
    this.log('RTMonitorAPI connect()');

    this.sock = new SockJS(this.RTMONITOR_URI);

    this.sock.onopen = function() {
                self.log('** socket open');
                clearInterval(self.sock_timer); // delete reconnect timer if it's running
                self.sock_send_str('{ "msg_type": "rt_connect" }');
    };

    this.sock.onmessage = function(e) {
                var msg = JSON.parse(e.data);
                if (msg.msg_type != null && msg.msg_type == "rt_nok")
                {
                    self.log('RTMonitorAPI error '+e.data);
                    return;
                }
                if (msg.msg_type != null && msg.msg_type == "rt_connect_ok")
                {
                    self.log('RTMonitorAPI connected OK ('+self.connect_callbacks.length+' clients)');
                    for (var i=0; i<self.connect_callbacks.length; i++)
                    {
                        var caller = self.connect_callbacks[i]; // { caller: xx, callback: yy }
                        caller.callback();
                    }
                    return;
                }

                if (msg.request_id)
                {
                    self.log('RTMonitorAPI websocket message received for '+msg.request_id);
                    //self.log(e.data);

                    var caller = self.request_callbacks[msg.request_id];

                    caller.callback(msg);
                }
                else
                {
                    self.log('RTMonitorAPI websocket message returned with no request_id'+e.data);
                }

    };

    this.sock.onclose = function() {
                self.log('RTMonitorAPI socket closed, starting reconnect timer');

                self.request_callbacks = {};

                for (var i=0; i<self.disconnect_callbacks.length; i++)
                {
                    self.disconnect_callbacks[i].callback.call(self.disconnect_callbacks[i].caller)
                }
                // start interval timer trying to reconnect
                clearInterval(this.sock_timer);
                self.sock_timer = setInterval(function (rt) { return function () { rt.reconnect(); } }(self), 10000);
    };
};

this.ondisconnect = function (callback)
{
    self.disconnect_callbacks.push({ callback: callback });
};

this.onconnect = function(callback)
{
    self.connect_callbacks.push({ callback: callback });
    self.log('RTMonitorAPI onconnect '+self.connect_callbacks.length);
};

this.reconnect = function()
{
    self.log('sock_reconnect trying to connect');
    self.connect();
};

this.connected = function()
{
    self.log('RTMonitorAPI connected');
};

this.disconnect = function()
{
    self.log('** closing socket...');
    self.sock.close();
};

// Caller has issued a request for one-time return of sensor data
this.request = function(caller, caller_id, request_id, msg, request_callback)
{
    var caller_request_id = caller_id+'_'+request_id;
    this.log('RTMonitorAPI request request_id '+caller_request_id);

    this.request_callbacks[caller_request_id] = { caller: caller, callback: request_callback } ;

    return this.sock_send_str(msg);
};

// Caller has issued subscription for regular real-time return of sensor data
this.subscribe = function(caller_id, request_id, msg_obj, request_callback)
{
    // Note that RTMonitorAPI builds the actual unique request_id that goes to the server
    // as a concatenation of the caller_id and the request_id given by the caller.
    var caller_request_id = caller_id+'_'+request_id;

    msg_obj.msg_type = 'rt_subscribe';
    msg_obj.request_id = caller_request_id;

    this.log('RTMonitorAPI subscribe request_id '+caller_request_id);

    var msg = JSON.stringify(msg_obj);

    this.request_callbacks[caller_request_id] = { callback: request_callback } ;

    return this.sock_send_str(msg);
};

this.unsubscribe = function(request_id)
{
    this.log('RTMonitorAPI unsubscribing '+request_id);

    this.sock_send_str( '{ "msg_type": "rt_unsubscribe", "request_id": "'+request_id+'" }' );
};

this.sock_send_str = function(msg)
{
    if (this.sock == null)
    {
	    this.log('<span style="color: red;">Socket not yet connected</span>');
	    return { status: 'rt_nok', reason: 'socket not connected' };
    }
    if (this.sock.readyState == SockJS.CONNECTING)
    {
	    this.log('<span style="color: red;">Socket connecting...</span>');
	    return { status: 'rt_nok', reason: 'socket still connecting' };
    }
    if (this.sock.readyState == SockJS.CLOSING)
    {
	    this.log('<span style="color: red;">Socket closing...</span>');
	    return { status: 'rt_nok', reason: 'socket closing' };
    }
    if (this.sock.readyState == SockJS.CLOSED)
    {
	    this.log('<span style="color: red;">Socket closed</span>');
	    return { status: 'rt_nok', reason: 'socket closed' };
    }

    this.log('RTMonitorAPI sending: '+msg);

    this.sock.send(msg);

	return { status: 'rt_ok', reason: 'sent message' };
};

this.log = function(str)
{
    if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('rtmonitor_api_log') >= 0)
    {
        console.log(str);
    }
};

// END of 'class' RTMonitorAPI
}

