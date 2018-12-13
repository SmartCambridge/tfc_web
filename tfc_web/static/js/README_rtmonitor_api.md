# rtmonitor_api.js README

`rtmonitor_api.js` is a client-side Javascript proxy for
[RTMonitor](https://github.com/SmartCambridge/tfc_server/tree/master/src/main/java/uk/ac/cam/tfc_server/rtmonitor).

The link given above contains the details of the actual messages than can be passed back and forth between
RTMonitor (the message-passing server feed provider) allows javascript clients to connect via a websockect, and
then responds to Json messages from those clients requesting *subscriptions* to real-time data.

Our RTMonitor *server* is written in Java/Vertx, in which the websocket support is provided by a server-side SockJS 
module and using the client-side Javascript SockJS client allows the connection to fall back to alternative protocols 
(e.g. HTML long-polling) if websockets are not available/accessible.

`rtmonitor_api.js` effectively acts as a client-side proxy for multiple connections to RTMonitor, avoiding concurrent
connection count limits when SockJS falls back to its alternative transports.

## Example usage in subscribing to bus data

### 1. The page loads, and an instance of `rtmonitor_api` is created

```
<script src="rtmonitor_api.js"></script>

<script>
var CLIENT_DATA = { rt_client_name: 'RTRoute V7.77',
                    rt_client_id:   'rtroute',
                    rt_token:       '888'
                  };
RTMONITOR_API = new RTMonitorAPI(CLIENT_DATA);
</script>
```
Note from here onwards we'll refer to the instance of RTMonitorAPI as `RTMONITOR_API`.

### 2. At some point on the client page, the client will register with `RTMONITOR_API`

```
function connect_callback() { /* do something when rtmonitor_api connects to server */ };

function disconnect_callback() { /* do something when rtmonitor_api disconnects from server */ };

rt_client = RTMONITOR_API.register(connect_callback, disconnect_callback);
```

Note that the callbacks are purely for the purposes of the client application, i.e. there is
nothing they particularly need to do with `RTMONITOR_API` itself. However, if the client
application expects to immediately `subscribe` to some data on startup (see below) then the 
`connect_callback` is a logical place to put that subscription request.

Note also that the callbacks are only being *registered* at this point. They will not be called
until *after* the client has called the `rt_client.connect()` even if `RTMONITOR_API` is already
connected at the time of the `RTMONITOR_API.register(..)` call.

Now the client has an `rt_client` local object, all interation with `RTMONITOR_API` is via that
object via object methods.

### 3. The client tells `RTMONITOR_API` it is ready to connect

```
rt_client.connect(); // rt_client was returned by RTMONITOR_API.register(..) earlier
```

If `RTMONITOR_API` is *already* connected via a websocket connection to the RTMonitor server,
then the client `connect_callback()` will immediately be called.

If `RTMONITOR_API` is not currently connected to the server then it will establish a
websocket connection and after a successful handshake will call the client `connect_callback`.
(I.e. `RTMONITOR_API` will send a `rt_connect` message and receive a `rt_connect_ok` message in
return. Details of this exchange are in the
[RTMonitor](https://github.com/SmartCambridge/tfc_server/tree/master/src/main/java/uk/ac/cam/tfc_server/rtmonitor)
documentation).

### 4. The client can subscribe to message data

E.g. to receive real-time position data for a bus with `VehicleRef = "WP-110"`:

Firstly the client must define a function to be called if and when any data from the
subscription subsequently arrives:

```
function subscription_callback(subscription_data)
{
    // subscription data is the data object asynchronously returned by RTMonitor.
    // Typically subscription_data["request_data"] will be an array of data records,
    // each as a javascript object
}
```

The client can then make the subscription request:
```
var request_id = "A";

var msg_obj = { "filters" : [
                              { "test": "=",
                                "key": "VehicleRef",
                                "value": "WP-110"
                              }
                            ]
              };

rt_client.subscribe(request_id, msg_obj, subscription_callback);
```

In the example above it is likely that the client may make multiple subscriptions, in which
case each `request_id` must be unique for that client. In this example the `VehicleRef` could
be used as a `request_id`, assuming each client subscription is for a different vehicle.

Note that in acting as a 'proxy', `RTMONITOR_API` will *mangle* the client `request_id` values
to ensure that are unique across all clients of this socket connection to the server (the
server will ensure requests from multiple `RTMonitor`s don't get mixed up).  `RTMONITOR_API` does this
by internally assigning a `client_id` to each client when they `register` and prepending that
to the `request_id`.  So the actual subscription message to the server from `RTMONITOR_API`
becomes:

```
{ "msg_type": "rt_subscribe",
  "request_id": "rt_0_A",
  "filters" : [
                { "test": "=",
                  "key": "VehicleRef",
                  "value": "WP-110"
                }
              ]
}
```

## List of RTMonitorAPI/`rt_client` methods

`var RTMONITOR_API = new RTMonitorAPI(CLIENT_DATA);`
Instantiates a new RTMonitorAPI object, see example above.

`var rt_client = RTMONITOR_API.register(connect_callback, disconnect_callback);`
Client registers with `RTMONITOR_API`.

`rt_client.connect()`
Client tells `RTMONITOR_API` it is ready for connection. `connect_callback()` will be called
when `RTMONITOR_API` connects to server, or immediately if already connected.

`rt_client.subscribe(request_id, msg_obj, callback);`
See example above. `request_id` is unique for this JS client, and will be *mangled* (see example) to
be unique on this web page. `msg_obj` contains the `filter` parameter for
the desired records, and the `callback` will be called as the records arrive.

`rt_client.unsubscribe(request_id);`
Send unsubscription request to the server.  `RTMONITOR_API` will mangle the `request_id` to
match the one used in the original `subscribe()`.

`rt_client.request(request_id, msg_obj, callback);`
Similar to `.subscribe(..)` except only the *latest* records matching the filter in `msg_obj` will be
returned, i.e. the request will return a set of data records in a single message and data will not
continue to asynchronously arrive as they would with a subscription.

`rtclient.raw(msg_obj, callback)`
A super version of `.subscribe(..)` and `.request(..)` where no `request_id` mangling takes place and the 
client is responsible for building the complete message to go to the RTMonitor server including the 
`request_id` and the `msg_type`.
(see [RTMonitor](https://github.com/SmartCambridge/tfc_server/tree/master/src/main/java/uk/ac/cam/tfc_server/rtmonitor)).

`rt_client.close()`
The client closes its connection to `RTMONITOR_API`. If this is the last client connected to `RTMONITOR_API` 
then `RTMONITOR_API` will close its websocket to the server.


