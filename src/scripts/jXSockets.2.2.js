/*
* XSockets.NET jXSockets.2.0.0.beta
* http://xsockets.net/
* Distributed in whole under the terms of the MIT
 
*
* Copyright 2012, Magnus Thor & Ulf Björklund
*
* Permission is hereby granted, free of charge, to any person obtaining
* a copy of this software and associated documentation files (the
* "Software"), to deal in the Software without restriction, including
 
* without limitation the rights to use, copy, modify, merge, publish,
* distribute, sublicense, and/or sell copies of the Software, and to
* permit persons to whom the Software is furnished to do so, subject to
* the following conditions:
 
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
* LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 
* OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
* WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*
*/
var Queue = function (options) {
    var self = this;
    this.settings = options;
    this.length = 0;
    this.items = [];
    this.timer = 0;
    self.items.push = function (data) {
        self.length++;
        if (self.length === 1) self.timer = setInterval(function () {
            var arr = self.items.slice(0, 1);
            if (arr.length === 1) {
                self.items.remove(arr[0]);
                options.dequeued.call(this, arr[0]);
            }
        }, options.interval);
        return Array.prototype.push.call(this, data);
    };
    self.items.remove = function () {
        var what, a = arguments,
            l = a.length,
            ax;
        while (l && this.length) {
            what = a[--l];
            while ((ax = this.indexOf(what)) != -1) {
                this.splice(ax, 1);
            }
        }
        self.length--;
        if (self.length === 0) {
            options.clean.call(this);
            clearInterval(self.timer);
        }
        return this;
    };
    this.enqueue = function (value) {
        self.items.push({
            k: self.length,
            v: value
        });
    };
    this.cleanUp = function () {
        clearInterval(self.timer);
        self.items = [];
    };
    this.Empty = function () {
        self.items.forEach(function (item) {
            options.dequeued.call(this, item);
            self.items.remove(item);
        }, this);
        clearInterval(self.timer);
    };
};
var Subscriptions = (function () {
    /// <summary>
    ///     Module to handle subscriptions (add,get,remove) and all its callbacks.
    /// </summary>           
    var subscriptions = [];
    this.add = function (name, fn, opt) {
        /// <summary>
        ///     if a subscription with the same name exists the function will be
        ///     added to the callback list.
        ///     if the subscription does not exist a new one will be created.
        ///     
        ///     Returns the index of the callback added to be used if you only want to remove a specific callback.
        /// </summary>
        /// <param name="name" type="string">
        ///    Name of the subscription.
        /// </param>
        /// <param name="fn" type="function">
        ///    The callback function to add
        /// </param>
        name = name.toLowerCase();
        var storedSub = this.get(name);
        if (storedSub === null) {
            var sub = new subscription(name);
            sub.addCallback(fn, opt);
            subscriptions.push(sub);
            return 1;
        }
        storedSub.addCallback(fn, opt);
        return storedSub.Callbacks.length;
    };
    this.get = function (name) {
        /// <summary>
        ///     Returns the subscription and all its callbacks.
        ///     if not found null is returned.
        /// </summary>
        /// <param name="name" type="string">
        ///    Name of the subscription.
        /// </param> 
        name = name.toLowerCase();
        for (var i = 0; i < subscriptions.length; i++) {
            if (subscriptions[i].Name === name) return subscriptions[i];
        }
        return null;
    };
    this.getAll = function () {
        /// <summary>
        ///     Returns all the subscriptions.        
        /// </summary>
        return subscriptions;
    };
    this.remove = function (name, ix) {
        /// <summary>
        ///     Removes a subscription with the matching name.
        ///     if ix of a callback is passed only the specific callback will be removed.
        ///     
        ///     Returns true if something was removed, false if nothing was removed.
        /// </summary>
        /// <param name="name" type="string">
        ///    Name of the subscription.
        /// </param>
        /// <param name="ix" type="number">
        ///    The index of the callback to remove (optional)
        /// </param>
        name = name.toLowerCase();
        for (var i = 0; i < subscriptions.length; i++) {
            if (subscriptions[i].Name === name) {
                if (ix === undefined) {
                    subscriptions.splice(i, 1);
                } else {
                    subscriptions[i].Callbacks.splice(ix - 1, 1);
                    if (subscriptions[i].Callbacks.length === 0) subscriptions.splice(i, 1);
                }
                return true;
            }
        }
        return false;
    };
    this.fire = function (name, message, cb, ix) {
        /// <summary>
        ///     Triggers all callbacks on the subscription, or if ix is set only that callback will be fired.
        /// </summary>
        /// <param name="name" type="string">
        ///    Name of the subscription.
        /// </param>
        /// <param name="ix" type="number">
        ///    The index of the callback to trigger (optional)
        /// </param>
        name = name.toLowerCase();
        for (var i = 0; i < subscriptions.length; i++) {
            if (subscriptions[i].Name === name) {
                if (ix === undefined) {
                    subscriptions[i].fireCallbacks(message, cb);
                } else {
                    subscriptions[i].fireCallback(message, cb, ix);
                }
            }
        }
    };
    var subscription = function (name) {
        this.Name = name;
        this.Callbacks = [];
        this.addCallback = function (fn, opt) {
            this.Callbacks.push(new callback(fn, opt));
        };
        this.fireCallback = function (message, cb, ix) {
            var _c = this.Callbacks[ix - 1];
            if (typeof (_c).fn !== "function") return;
            _c.fn(message);
            

            //Handle potential unbind for one and many
            if (typeof (this.Callbacks[ix - 1].state) === "object") {
                if (typeof (this.Callbacks[ix - 1].state.options) !== "undefined" && typeof (this.Callbacks[ix - 1].state.options.counter) !== "undefined") {
                    this.Callbacks[ix - 1].state.options.counter.messages--;
                    if (this.Callbacks[ix - 1].state.options.counter.messages === 0) {
                        if (typeof (this.Callbacks[ix - 1].state.options.counter.completed) === 'function') {
                            this.Callbacks[ix - 1].state.options.counter.completed();
                        }
                    }
                }
            }
            if (cb && typeof (cb) === "function") {
                cb();
            }
        };
        this.fireCallbacks = function (message, cb) {
            for (var c = 0; c < this.Callbacks.length; c++) {
                this.fireCallback(message, cb, c + 1);
            }
        };
    };
    var callback = function (func, opt) {
        this.fn = func;
        this.state = opt;
    };
    return this;
});
(function () {
    "use strict";
    var jXSockets = {
        Queue: true,
        Delay: 30,
        Events: {
            onError: "xsockets.onerror",
            open: "xsockets.xnode.open",
            close: "close",
            storage: {
                set: "xsockets.storage.set",
                get: "xsockets.storage.get",
                getAll: "xsockets.storage.getall",
                remove: "xsockets.storage.remove"
            },
            serverstatus: {
                status: "xsockets.server.status"
            },
            onBlob: "blob",
            connection: {
                getallclients: "xsockets.getallclients",
                onclientconnect: "xsockets.onclientconnect",
                onclientdisconnect: "xsockets.onclientdisconnect",
                disconnect : "xsockets.disconnect"
            }
        },
        Utils: {
            getParameterByName: function (name) {
                name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
                var regexS = "[\\?&]" + name + "=([^&#]*)";
                var regex = new RegExp(regexS);
                var results = regex.exec(window.location.search);
                if (results == null)
                    return "";
                else
                    return decodeURIComponent(results[1].replace(/\+/g, " "));
            },
            extend: function (obj, extObj) {
                if (arguments.length > 2) {
                    for (var a = 1; a < arguments.length; a++) {
                        extend(obj, arguments[a]);
                    }
                } else {
                    for (var i in extObj) {
                        obj[i] = extObj[i];
                    }
                }
                return obj;
            },
            guid: function (a, b) {
                for (b = a = ''; a++ < 36; b += a * 51 & 52 ? (a ^ 15 ? 8 ^ Math.random() * (a ^ 20 ? 16 : 4) : 4).toString(16) : '-');
                return b;
            }
        },
        WebSocket: function (url, subprotocol, settings) {
            /// <summary>
            /// XSockets.NET JavaScript API 
            /// </summary>
            ///<param name="url" type="String">
            /// The WebSocket handler (URL) to connect to. i.e ws://127.0.0.1:4502/GenericText
            ///</param>
            ///<param name="subprotocol" type="String">
            /// Subprotocol i.e GenericText 
            ///</param>          
            var webSocket = null;
            var self = this;

            var subscriptions = new Subscriptions();


            var options = XSockets.Utils.extend({
                queue: jXSockets.Queue,
                apikey: null,
                parameters: {}
            }, settings);
            

            this.handler = subprotocol;
            this.channel = {};
            if (options.queue) {
                var queueSettings = {
                    dequeued: function (item) {
                        triggerDequeued(item.v.event, item.v.json, item.v.callback);
                    },
                    clean: function () { },
                    interval: jXSockets.Delay
                };
                this.Queue = new Queue(queueSettings);
            }
            var pubSub = {
                subscribe: "xsockets.subscribe",
                unsubscribe: "xsockets.unsubscribe",
                getSubscriptions: "xsockets.getsubscriptions",
                getAllSubscriptions: "xsockets.getallsubscriptions"
            };
            var parameters = function (p) {
                var str = "?";
                for (var key in p) {
                    str += key + '=' + encodeURIComponent(p[key]) + '&';
                }
                str = str.slice(0, str.length - 1);
                return str;
            };
            this.close = function (fn) {
                /// <summary>
                ///     Close the current XSocket WebSocket instance
                /// </summary>
                /// <param name="fn" type="function">
                ///    A function to execute when closed.
                /// </param>   
                this.trigger(XSockets.Events.connection.disconnect, { },fn);
                //webSocket.close();
                //if (typeof fn === "function") fn();
            };

            this.getSubscriptions = function () {
                /// <summary>
                ///     Get all subscriptions for the current Handler
                /// </summary>
                return subscriptions.getAll();
            };

            this.bind = function (event, fn, opts, callback) {
                /// <summary>
                ///     Attach a handler (subscription) for the current WebSocket Handler
                /// </summary>
                /// <param name="event" type="string">
                ///    Name of the event to subscribe to (bind)
                /// </param> 
                /// <param name="fn" type="function">
                ///    A function to execute each time the event (subscription) is triggered.
                /// </param>   
                /// <param name="options" type="object">
                ///   event (subscriptions) options
                /// </param>
                /// <param name="callback" type="function">
                ///    A function to execute when completed.
                /// </param>
                var o = {
                    options: opts,
                    ready: webSocket.readyState
                };
                if (o.ready === 1) {
                    self.trigger(new XSockets.Message(pubSub.subscribe, {
                        Event: event
                    }));
                }
                subscriptions.add(event, fn, o);
                if (callback && typeof (callback) === "function") {
                    callback();
                }
            };
            this.unbind = function (event, callback) {
                /// <summary>
                ///     Remove a previously-attached event handler (subscription).
                /// </summary>
                /// <param name="event" type="String">
                ///    Name of the event (subscription) to unbind.
                /// </param>           
                /// <param name="callback" type="function">
                ///    A function to execute when completed.
                /// </param>   
                if (subscriptions.remove(event)) {
                    self.trigger(new XSockets.Message(pubSub.unsubscribe, {
                        Event: event
                    }));
                }
                if (callback && typeof (callback) === "function") {
                    callback();
                }
            };
            this.many = function (event, count, callback, opts) {
                /// <summary>
                ///     Attach a handler to an event (subscription) for the current WebSocket Handler,  unbinds when the event is triggered the specified number of (count) times.
                /// </summary>
                /// <param name="event" type="String">
                ///    Name of the event (subscription)
                /// </param>           
                /// <param name="count" type="Number">
                ///     Number of times to listen to this event (subscription)
                /// </param>           
                /// <param name="callback" type="Function">
                ///    A function to execute at the time the event is triggered the specified number of times.
                /// </param> 
                /// <param name="options" type="object">
                ///   event (subscriptions) options
                /// </param>
                self.bind(event, callback, XSockets.Utils.extend({
                    counter: {
                        messages: count,
                        completed: function () {
                            self.unbind(event);
                        }
                    }
                }, opts));
            };
            this.one = function (event, callback, opts) {
                /// <summary>
                ///    Attach a handler to an event (subscription) for the current WebSocket Handler. The handler is executed at most once.
                /// </summary>
                /// <param name="event" type="String">
                ///    Name of the event (subscription)
                /// </param>           
                /// <param name="callback" type="Function">
                ///    A function to trigger when executed once.
                /// </param>       
                /// <param name="options" type="object">
                ///   event (subscriptions) options
                /// </param>  
                self.bind(event, callback, XSockets.Utils.extend({
                    counter: {
                        messages: 1,
                        completed: function () {
                            self.unbind(event);
                        }
                    }
                }, opts));
            };
            this.trigger = function (event, json, callback) {
                /// <summary>
                ///      Trigger (Publish)  a WebSocketMessage (event) to the current WebSocket Handler.
                /// </summary>
                /// <param name="event" type="string">
                ///     Name of the event (publish)
                /// </param>                
                /// <param name="json" type="JSON">
                ///     JSON representation of the WebSocketMessage to trigger/send (publish)
                /// </param>
                /// <param name="callback" type="function">
                ///      A function to execute when completed. 
                /// </param>
                if (options.queue) {
                    self.Queue.enqueue({
                        event: event,
                        json: json,
                        callback: callback
                    });
                } else {
                    triggerDequeued(event, json, callback);
                }
            };
            var triggerDequeued = function (event, json, callback) {
                if (typeof (event) !== "object") {
                    event = event.toLowerCase();
                    var message = XSockets.Message(event, json);
                    send(message.toString());
                    if (callback && typeof (callback) === "function") {
                        callback();
                    }
                } else {
                    send(event.toString());
                    if (json && typeof (json) === "function") {
                        json();
                    }
                }
            };
            this.send = function (payload) {
                /// <summary>
                ///     Send a binary message to the current WebSocket Handler
                /// </summary>
                /// <param name="payload" type="BLOB">
                ///     Binary object to send (Blob/ArrayBuffer).
                /// </param>                  
                webSocket.send(payload);
            };
            var dispatch = function (eventName, message) {
                if (subscriptions.get(eventName) === null) {
                    return;
                }
                if (typeof message === "string") {
                    message = JSON.parse(message);
                }
                subscriptions.fire(eventName, message, function () {
                    //console.log('stupid callback');
                });
            };
            var raiseEvent = function (message) {
                var event = null;
                if (typeof message.data === "string") {
                    var msg = JSON.parse(message.data);
                    event = msg.event;
                  
                    dispatch(event, msg.data);
                } else {
                    dispatch(XSockets.Events.onBlob, message.data);
                }
            };
            var send = function (payload) {
                webSocket.send(payload);
            };
            Array.prototype.removeItem = function (str) {
                for (var i = 0; i < this.length; i++) {
                    if (escape(this[i]).match(escape(str.trim()))) {
                        this.splice(i, 1);
                        break;
                    }
                }
                return this;
            };
            if ('WebSocket' in window) {
                var clientGuid = window.localStorage.getItem("XSocketsClientStorageGuid" + subprotocol) !== null ? window.localStorage.getItem("XSocketsClientStorageGuid" + subprotocol) : null;
                if (options.apikey !== null) {
                    options.parameters["apikey"] = options.apikey;
                }
                if (clientGuid !== null) {
                    options.parameters["XSocketsClientStorageGuid"] = clientGuid;
                }
                url = url + parameters(options.parameters);
                webSocket = new window.WebSocket(url, subprotocol);
            }
            if (webSocket !== null) {
                self.bind(jXSockets.Events.open, function (data) {
                    window.localStorage.setItem("XSocketsClientStorageGuid" + subprotocol, data.StorageGuid);
                    var chain = subscriptions.getAll();
                    for (var e = 0; e < chain.length; e++) {
                        for (var c = 0; c < chain[e].Callbacks.length; c++) {
                            if (chain[e].Callbacks[c].ready !== 1) {
                                self.trigger(new XSockets.Message(pubSub.subscribe, {
                                    Event: chain[e].Name
                                }));
                            }
                        }
                    }
                }, {
                    subscribe: false
                });
                webSocket.onclose = function (msg) {
                    self.Queue.cleanUp();
                    dispatch('close', msg);
                };
                webSocket.onopen = function (msg) {
                    dispatch('open', msg);
                };
                webSocket.onmessage = function (message) {
                    raiseEvent(message);
                };
            }
            return {
                close: self.close,
                bind: self.bind,
                unbind: self.unbind,
                one: self.one,
                many: self.many,
                on: self.bind,
                off: self.unbind,
                trigger: self.trigger,
                triggerBinary: self.send,
                send: self.send,
                channel: self.channel,
                subscribe: self.bind,
                publish: self.trigger,
                subscriptions: self.getSubscriptions
            };
        },
        Channel: function () {
            var create = function (url, handler, settings) {
                /// <summary>
                ///      Create a new Channel (Private connection to the specified handler)
                /// </summary>
                /// <param name="url" type="string">
                ///     WebSocket URL
                /// </param>                
                /// <param name="handler" type="string">
                ///     The handler/controller to connect to 
                /// </param>
                /// <param name="settings" type="object">
                ///     settings / options (parameters etc)
                /// </param>
                var id = jXSockets.Utils.guid();
                var channelUrl = url + "/" + id;
                var ws = new XSockets.WebSocket(channelUrl, handler, settings);
                ws.channel = {
                    Id: id,
                    args: [channelUrl, handler, settings]
                };
                return ws;
            };
            var connect = function (channel) {
                /// <summary>
                ///      Connect to a channel 
                /// </summary>
                /// <param name="channel" type="object">
                ///     Channel to connect to
                /// </param>                
                return new XSockets.WebSocket(channel.args[0], channel.args[1], channel.args[2]);
            };
            return {
                Create: create,
                Connect: connect
            };
        }(),
        Message: function (event, object) {
            /// <summary>
            ///     Create a new XSockets Message
            /// </summary>
            /// <param name="event" type="string">
            ///     Name of the event
            /// </param>             
            /// <param name="object" type="object">
            ///     The message payload (JSON)
            /// </param>  
            var json = {
                event: event,
                data: JSON.stringify(object)
            };
            this.JSON = function () {
                return json;
            }();
            this.toString = function () {
                return JSON.stringify(json);
            };
            return this;
        }
    };
    if (!window.jXSockets) {
        window.jXSockets = jXSockets;
    }
    if (!window.XSockets) {
        window.XSockets = jXSockets;
    }
})();