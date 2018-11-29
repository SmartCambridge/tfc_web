"use strict"
/* JS Socket code to access RTMonitor real-time sirivm data */
//
// 3.1  restructure of rtmonitor API, .register(..) returns api object (.connect, .subscribe, .unsubscribe)
// 3.0  move most this.X -> var X
// 2.0  restructure to Object + methods
// 1.0  initial working version RTMonitor JS Proxy
//
function RTMonitorAPI(client_data) {

// client_data will passed to rt_monitor at connect time
// to help identify/validate the client.
// client_data = { rt_client_id: <unique id for this client>
//                 rt_client_name: <some descriptive name, e.g. display name>
//                 rt_client_url: <location.href of this connecting web page client>
//                 rt_token: <token to be passed to rt_monitor in the connection to validate>
//               }

var RTMONITOR_URI = 'https://smartcambridge.org/rtmonitor/sirivm';
//this.RTMONITOR_URI = 'https://tfc-app2.cl.cam.ac.uk/rtmonitor/sirivm';
//this.RTMONITOR_URI = 'http://tfc-app2.cl.cam.ac.uk/test/rtmonitor/sirivm';

var self = this;

var VERSION = '3.1';

//var DEBUG = 'rtmonitor_api_log';

if (client_data)
{
    self.client_data = client_data;
}
else
{
    self.client_data = {};
    self.client_data.rt_client_id = 'unknown';
    self.client_data.rt_token = 'unknown';
    self.client_data.rt_client_name = 'rtmonitor_api.js V'+VERSION;
}
self.client_data.rt_client_url = location.href;

console.log('RTMonitorAPI V'+VERSION+' instantiation',self.client_data);

var sock = {}; // the page's WebSocket

var sock_timer = {}; // intervalTimer we use for retries iif socket has failed

//var connect_callbacks = [];

//var disconnect_callbacks = [];

var request_callbacks = {}; // dictionary of request_id -> callback_function for requests and subscriptions

var rt_connected = false; // whether the websocket is connected or not

var clients = new Array();

var next_client_index = 1; // We will give each client a unique id

// for debug, test socket disconnect with '#' key
document.onkeydown = function(evt) {
    evt = evt || window.event;
    log('keydown '+evt.keyCode);
    if (evt.keyCode == 222) // '#' keycode
    {
        disconnect();
        //clearInterval(self.progress_timer);
    }
}; // end onkeydown

/*
this.init = function()
{
    log('RTMonitorAPI init()');

    self.connect();
};
*/
this.init = function () {};


// ***************************************************************************
// *******************  WebSocket code    ************************************
// ***************************************************************************
// sock_connect() will be called on startup (i.e. in init())
// It will connect socket, when successful will
// send { 'msg_type': 'rt_connect'} message, and should receive { 'msg_type': 'rt_connect_ok' }, then
// send { 'msg_type': 'rt_subscribe', 'request_id' : 'A' } which subsribes to ALL records.
this.connect = function()
{
    log('RTMonitorAPI connect()');

    sock = new SockJS(RTMONITOR_URI);

    sock.onopen = function() {
                log('** socket open');
                clearInterval(sock_timer); // delete reconnect timer if it's running

                var msg_obj = { msg_type: 'rt_connect',
                                client_data: self.client_data
                              };

                self.sock_send_str(JSON.stringify(msg_obj));
    };

    sock.onmessage = function(e) {
                var msg = JSON.parse(e.data);
                if (msg.msg_type != null && msg.msg_type == "rt_nok")
                {
                    log('RTMonitorAPI error '+e.data);
                    return;
                }
                if (msg.msg_type != null && msg.msg_type == "rt_connect_ok")
                {
                    log('RTMonitorAPI connected OK ('+clients.length+' clients)');

                    rt_connected = true;

                    for (var i=0; i<clients.length; i++)
                    {
                        if ( clients[i].connected )
                        {
                            clients[i].connect_callback();
                        }
                    }
                    return;
                }

                if (msg.request_id)
                {
                    log('RTMonitorAPI websocket message received for '+msg.request_id);
                    //self.log(e.data);

                    var caller = request_callbacks[msg.request_id];

                    caller.callback(msg);
                }
                else
                {
                    log('RTMonitorAPI websocket message returned with no request_id'+e.data);
                }

    };

    sock.onclose = function() {
                log('RTMonitorAPI socket closed, starting reconnect timer');

                rt_connected = false;

                request_callbacks = {};

                for (var i=0; i<clients.length; i++)
                {
                    if (clients[i].connected) {
                        clients[i].disconnect_callback();
                    }
                }
                // start interval timer trying to reconnect
                clearInterval(sock_timer);
                sock_timer = setInterval(reconnect, 10000);
    };
};

// Register a client to RTMonitorAPI
// will return an object with connect, close, request, subscribe methods
this.register = function (connect_callback, disconnect_callback) {
    var client_id = 'rt_'+(next_client_index++);
    var client = { client_id: client_id,
                   connect_callback: connect_callback,
                   disconnect_callback: disconnect_callback,
                   subscribe: rt_subscribe(client_id),
                   unsubscribe: rt_unsubscribe(client_id),
                   //subscribe: function (request_id, msg_obj, request_callback) {
                   //               return subscribe(client_id, request_id, msg_obj, request_callback);
                   //           },
                   //unsubscribe: function (request_id) {
                   //                 return unsubscribe(client_id, request_id);
                   //             },
                   request_ids: new Array(),
                   connected: false,
                   connect: function () {
                                this.connected = true;
                                if (rt_connected)
                                {
                                    this.connect_callback();
                                }
                            },
                   close: function () { close(client_id); }
                 };
    clients.push(client);
    return client;
}

/*
this.ondisconnect = function (callback)
{
    disconnect_callbacks.push({ callback: callback });
};

this.onconnect = function(callback)
{
    connect_callbacks.push({ callback: callback });
    log('RTMonitorAPI onconnect '+connect_callbacks.length);
};
*/

// Caller has issued a request for one-time return of sensor data
this.request = function(caller, caller_id, request_id, msg, request_callback)
{
    var caller_request_id = caller_id+'_'+request_id;
    log('RTMonitorAPI request request_id '+caller_request_id);

    request_callbacks[caller_request_id] = { caller: caller, callback: request_callback } ;

    return this.sock_send_str(msg);
};

function rt_subscribe(client_id)
{
    return function(request_id, msg_obj, callback) {
               log('subscribe '+request_id);
               return subscribe(client_id+'_'+request_id, msg_obj, callback);
    };
}

// Caller has issued subscription for regular real-time return of sensor data
function subscribe(request_id, msg_obj, request_callback)
{
    // Note that RTMonitorAPI builds the actual unique request_id that goes to the server
    // as a concatenation of the caller_id and the request_id given by the caller.
    //var caller_request_id = caller_id+'_'+request_id;

    msg_obj.msg_type = 'rt_subscribe';
    //msg_obj.request_id = caller_request_id;
    msg_obj.request_id = request_id;

    log('RTMonitorAPI subscribe request_id '+request_id);

    var msg = JSON.stringify(msg_obj);

    //request_callbacks[caller_request_id] = { callback: request_callback } ;
    request_callbacks[request_id] = { callback: request_callback } ;

    return self.sock_send_str(msg);
};

function rt_unsubscribe(client_id)
{
    return function(request_id) {
        log('unsubscribe '+request_id);
        return unsubscribe(client_id+'_'+request_id);
    }
}

function unsubscribe(request_id)
{
    // Note that RTMonitorAPI builds the actual unique request_id that goes to the server
    // as a concatenation of the caller_id and the request_id given by the caller.
    //var caller_request_id = caller_id+'_'+request_id;

    log('RTMonitorAPI unsubscribing '+request_id);

    return self.sock_send_str( '{ "msg_type": "rt_unsubscribe", "request_id": "'+request_id+'" }' );
};

this.sock_send_str = function(msg)
{
    if (sock == null)
    {
	    log('Socket not yet connected');
	    return { status: 'rt_nok', reason: 'socket not connected' };
    }
    if (sock.readyState == SockJS.CONNECTING)
    {
	    log('Socket connecting...');
	    return { status: 'rt_nok', reason: 'socket still connecting' };
    }
    if (sock.readyState == SockJS.CLOSING)
    {
	    log('Socket closing...');
	    return { status: 'rt_nok', reason: 'socket closing' };
    }
    if (sock.readyState == SockJS.CLOSED)
    {
	    log('Socket closed');
	    return { status: 'rt_nok', reason: 'socket closed' };
    }

    log('RTMonitorAPI sending: '+msg);

    sock.send(msg);

	return { status: 'rt_ok', reason: 'sent message' };
};

this.close = function(caller_id) {
    log('RTMonitorAPI close('+caller_id+')');
}

function disconnect()
{
    log('** closing socket...');
    sock.close();
}

function reconnect()
{
    log('sock_reconnect trying to connect');
    self.connect();
}

function log(str)
{
    if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('rtmonitor_api_log') >= 0) {
        var args = [].slice.call(arguments);
        args.unshift('[RTMonitorAPI]');
        console.log.apply(console, args);
    }
}

// FINALLY, we connect to the server
this.connect();

// END of 'class' RTMonitorAPI
}

