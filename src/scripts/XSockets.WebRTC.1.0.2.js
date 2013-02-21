XSockets.WebRTC = function (ws, settings) {
    var self = this;
    var localStream;
  
    this.PeerConnections = {};
    this.DataChannels = {};    


    var defaults = {
        onPeerConnectionCreated: function () { },
        onDataChannelOpen: function () { },
        onDataChannelClose: function () {},
        onRemoteStream: function() {
            console.warning("There is no event handler attached for onRemoteStream");
        }
    };

    var options = XSockets.Utils.extend(defaults, settings);        
    
    var onLocalStream = options.onLocalStream;
    var onContextChange = options.onContextChange;
    var onRemoteStream = options.onRemoteStream;
    var onContextCreated = options.onContextCreated;
    var onPeerConnectionCreated = options.onPeerConnectionCreated;
    var onDataChannelOpen = options.onDataChannelOpen;
    var onDataChannelClose = options.onDataChannelClose;
    
    var Subscriptions = (function () {
        
        var subscriptions = [];
        this.add = function (name, fn, opt) {
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
            name = name.toLowerCase();
            for (var i = 0; i < subscriptions.length; i++) {
                if (subscriptions[i].Name === name) return subscriptions[i];
            }
            return null;
        };
        this.getAll = function () {
            return subscriptions;
        };
        this.remove = function (name, ix) {
           
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
                this.Callbacks[ix - 1].fn(message);
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
    this.bind = function (event, fn, opts, callback) {
        subscriptions.add(event, fn);
        if (callback && typeof (callback) === "function") {
            callback();
        }
    };
    this.unbind = function (event, callback) {
        subscriptions.remove(event);
        if (callback && typeof (callback) === "function") {
            callback();
        }
    };
    this.dispatch = function (eventName, message,clientGuid) {
        if (subscriptions.get(eventName) === null) {
            console.log("this",eventName,subscriptions.getAll());
            return;
        }
        if (typeof message === "string") {
            message = JSON.parse(message);
        }
        subscriptions.fire(eventName, message, function () {
        });
    };
    var config = {
    "iceServers": [{"url": "stun:stun.l.google.com:19302"}]
    };
    
    var subscriptions = new Subscriptions();

    this.channelPublish = function(event,json) {
        for (var c in self.DataChannels) {
            var channel = self.DataChannels[c];
            if (channel.readyState === "open") {
                var message = new XSockets.Message(event, json);
                channel.send(JSON.stringify(message));
            }
        }
    };
    this.closeChannel = function(id) {
        self.DataChannels[id].close();
    };
    this.channelSubscribe = function (event, peer,callback) {
       // for (var c in self.DataChannels) {
        self.bind(peer + event, callback);
        //}
    };
    this.channelUnsubscribe = function (event,peer, callback) {
        self.unbind(peer + event, callback);
    };
    var peerConnection = function (clientGuid) {
        var that = this;
        this.ClientGuid = clientGuid;
        
        this.RTCPeerConnection = new RTCPeerConnection(config, {
            optional: [{ RtpDataChannels: true }]
        });
        this.RTCPeerConnection.onconnection = function() {
        };
        try {
            self.DataChannels[clientGuid] = this.RTCPeerConnection.createDataChannel('RTCDataChannel', { reliable: false });
            self.DataChannels[clientGuid].onmessage = function(event) {
                var message = JSON.parse(event.data).JSON;
                

                self.dispatch(that.ClientGuid + message.event, message.data, that.ClientGuid);
            };
            self.DataChannels[clientGuid].onopen = function() {
                onDataChannelOpen(self.DataChannels[clientGuid]);
            };
            self.DataChannels[clientGuid].onclose = function() {
                onDataChannelClose(self.DataChannels[clientGuid]);
            };

        }catch(ex) {
            console.log("'Create Data channel failed with exception:", ex.message);
        }
        this.RTCPeerConnection.onstatechange = function(statechange) {
        };
        this.RTCPeerConnection.onaddstream = function (event) {
            onRemoteStream(event, clientGuid);
        };
        this.RTCPeerConnection.onicecandidate = function (event) {
            if (event.candidate) {
                var candidate = {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                };
                ws.trigger("contextsignal", {
                    sender: self.CurrentContext.ClientGuid,
                    recipient: clientGuid,
                    message: JSON.stringify(candidate)
                });
            }
        };
        // The Peer is Created
        onPeerConnectionCreated(that.ClientGuid);
    };

    self.bind("connect",function(peer) {
        self.PeerConnections[peer.ClientGuid] = new peerConnection(peer.ClientGuid);
        
        if(localStream)
        self.PeerConnections[peer.ClientGuid].RTCPeerConnection.addStream(localStream);
        
        self.PeerConnections[peer.ClientGuid].RTCPeerConnection.createOffer(function (localDescription) {
         self.PeerConnections[peer.ClientGuid].RTCPeerConnection.setLocalDescription(localDescription);
            ws.trigger("contextsignal", {
                sender: self.CurrentContext.ClientGuid,
                recipient: peer.ClientGuid,
                message: JSON.stringify(localDescription)
            });
        }, null, {
            'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': true
            }
        });
    });

    self.bind("candidate", function (event) {
        var candidate = JSON.parse(event.Message);
        self.PeerConnections[event.Sender].RTCPeerConnection.addIceCandidate(new RTCIceCandidate({
            sdpMLineIndex: candidate.label,
            candidate: candidate.candidate
        }));
    });
    self.bind("answer", function (event) {
        self.PeerConnections[event.Sender].RTCPeerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(event.Message)));
    });
    self.bind("offer", function (event) {
        self.PeerConnections[event.Sender] = new peerConnection(event.Sender);
        self.PeerConnections[event.Sender].RTCPeerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(event.Message)));
        if(localStream)
        self.PeerConnections[event.Sender].RTCPeerConnection.addStream(localStream);
        self.PeerConnections[event.Sender].RTCPeerConnection.createAnswer(function (description) {
            //description.spd = codecs.preferOpus(description.sdp);
            self.PeerConnections[event.Sender].RTCPeerConnection.setLocalDescription(description);
            ws.trigger("contextsignal",
                {
                    sender: self.CurrentContext.ClientGuid,
                    recipient: event.Sender,
                    message: JSON.stringify(description)
                });
        }, null, {
            'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': true
            }
        });
    });
    
    ws.subscribe("contextCreated", function (context) {
        self.CurrentContext = new XSockets.PeerContext(context.ClientGuid, context.Context);
        onContextCreated(context);
    });
    ws.subscribe("signal",function(signal){
        var msg = JSON.parse(signal.Message);        
        self.dispatch(msg.type, signal);
    });
    
    ws.subscribe("contextChange", onContextChange);
    
    ws.subscribe("connectTo", function (peers) {

        
        peers.forEach(function (peer) {
            self.dispatch("connect", peer);

        });
    });


    this.createChannel = function(id) {
    };

    this.changeContext = function (contextGuid) {
        ws.trigger("ChangeContext", { guid: contextGuid });
    };
    this.getUserMedia = function (userMediaSettings,callback) {
        console.log("userMediaSettings", userMediaSettings);
        window.getUserMedia(userMediaSettings, function (stream) {
            localStream = stream;
            
            onLocalStream(stream);
            

            if (callback && typeof (callback) === "function") 
                callback(self.CurrentContext);
     
        });
    };
};


XSockets.PeerContext = function (client, context) {
    this.ClientGuid = client;
    this.Context = context;
    
};


// Based on Googles example
var codecs = (function () {
    function preferOpus(sdp) {
        var sdpLines = sdp.split('\r\n');
        for (var i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].search('m=audio') !== -1) {
                var mLineIndex = i;
                break;
            }
        }
        if (mLineIndex === null)
            return sdp;
        for (var i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].search('opus/48000') !== -1) {
                var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
                if (opusPayload)
                    sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
                break;
            }
        }
        sdpLines = removeCN(sdpLines, mLineIndex);
        sdp = sdpLines.join('\r\n');
        return sdp;
    }
    function extractSdp(sdpLine, pattern) {
        var result = sdpLine.match(pattern);
        return (result && result.length == 2) ? result[1] : null;
    }
    function setDefaultCodec(mLine, payload) {
        var elements = mLine.split(' ');
        var newLine = new Array();
        var index = 0;
        for (var i = 0; i < elements.length; i++) {
            if (index === 3)
                newLine[index++] = payload;
            if (elements[i] !== payload)
                newLine[index++] = elements[i];
        }
        return newLine.join(' ');
    }
    function removeCN(sdpLines, mLineIndex) {


        console.log("removeCN", sdpLines, mLineIndex);

        var mLineElements = sdpLines[mLineIndex].split(' ');

        for (var i = sdpLines.length - 1; i >= 0; i--) {
            var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
            if (payload) {
                var cnPos = mLineElements.indexOf(payload);
                if (cnPos !== -1) {

                    mLineElements.splice(cnPos, 1);
                }
                sdpLines.splice(i, 1);
            }
        }
        sdpLines[mLineIndex] = mLineElements.join(' ');
        return sdpLines;
    }
    return {
        preferOpus: preferOpus
    };
}());