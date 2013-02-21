if (!String.linkify) {
    String.prototype.linkify = function () {
        var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;
        var pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
        var emailAddressPattern = /\w+@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6})+/gim;
        return this.replace(urlPattern, '<a target="_blank" href="$&">$&</a>').replace(pseudoUrlPattern, '$1<a href="http://$2">$2</a>').replace(emailAddressPattern, '<a href="mailto:$&">$&</a>');
    };
}


var isFormValid = function (selctor) {
    var valid = true;
    $(selctor).each(function () {
        if (!this.checkValidity()) valid = false;
    });
    return valid;
};



var organizer, joinNick, joinRoom, currentRoom, audio, manager,account;
var browserMeeting, notifications, clip;
var fileShare;
var baseUrl = location.origin + "/";

var xsockets = {
    url: "ws://127.0.0.1/RoomManagerController",
    controller: "RoomManagerController",
    settings: {}
};

var map, poker;
var profile = {};


$(function () {


    

    $("#jumbo a#home").tab("show");
    
    
    map = new google.maps.Map(document.querySelector("#map_canvas"), {
        zoom: 2,
        center: new google.maps.LatLng(62.87916, 12.32910),
        mapTypeId: google.maps.MapTypeId.ROADMAP
    });
    
  
    ZeroClipboard.setMoviePath("/scripts/ZeroClipboard.swf");
    var clip = new ZeroClipboard.Client("#copytoclipboard");
    
    if (!window.webkitRTCPeerConnection) {
        $("#error").modal('show');
    };
    $('#error').on('hidden', function () {
        $("#main").empty();
    });
    $("#noRoom").on("hidden", function () {
        location.href = "http://browsermeeting.com";
    });
    $(".videoSize").bind("click", function () {
        $(".video").each(function () {
            $(this).toggleClass("grow").toggleClass("shrink");
        });
    });

    $('a[data-toggle="tab"]').on('shown', function (e) {
        manager.trigger("locations", {});
        google.maps.event.trigger(map, 'resize');
        map.setZoom(map.getZoom());
    });
    

    // login

    $("#btnLogin").bind("click", function(evt) {
        evt.preventDefault();
        account.login($("#uid").val(), $("#pwd").val());
    });
    
    // Register for an account
    $("form input").blur(function (evt) {
        var s = evt.target.checkValidity();
        if (!s) {
            $(evt.target).parent().parent().addClass("error").removeClass("success");
        } else {
            $(evt.target).parent().parent().addClass("success").removeClass("error");
        }
    });
    $("form").bind("input", function () {
        $("form input").each(function () {
            if(this.id.length >0)
                profile[this.id] = this.value;
        });
        if (!isFormValid("form input")) {
            $("#btnCreateAccount").attr("disabled", "disabled");
        } else {
            account.updateProfile(profile);
            $("#btnCreateAccount").removeAttr("disabled");
        }
    });
    $("#toggleChars").mouseover(function() {
        $("#password").prop("type", "text");
    }).mouseleave(function() {
        $("#password").prop("type", "password");
    });

    $("#btnRegister").bind("click", function() {
        $("#createAccount").modal("show");
        $("#takePhoto").click("click", function() {
            var p = $(".photo").parent();
            p.children("img").remove();
            var photo = account.takePhoto($(".photo").width(), $(".photo").height());

            p.children("video").hide();
            $("<img>").attr({ src: photo}).addClass("photo").appendTo(p);


        }).mouseover(function() {
            var p = $(".photo").parent();
            if (p.children("img").length > 0) {
                p.children("img").hide();
                p.children("video").show();
            }
        }).mouseleave(function() {
            var p = $(".photo").parent();
            if (p.children("img").length > 0) {
                p.children("img").show();
                p.children("video").hide();
            }
        });
        account.createProfile(document.querySelector(".photo"),function(stream) {
            attachMediaStream(document.querySelector(".photo"), stream);
        });
    });

    $("#btnCreateAccount").bind("click", function(evt) {
        manager.trigger("CreateProfile", account.getProfile());
    });
    

    // Notifications

    notifications = new Notifications(function () {
        $("#acceptNotifications").show().bind("click", function () {
            notifications.approve();
        });
    });
    

    audio = new Audio();
    audio.load("pling", "/Content/Sound/pling.mp3");
    audio.load("push", "/Content/Sound/push.mp3");
    audio.load("error", "/Content/Sound/error.mp3");
    audio.load("poke", "/Content/Sound/knocking.mp3");


    joinNick = localStorage.nickName === undefined ? "John Doe" : localStorage.nickName;
    organizer = localStorage.nickName === undefined ? "Organizer (John Doe)" : "Organizer (" + localStorage.nickName + ")";
    if (localStorage.nickName !== undefined) {
        $("#joinNick,#nickName,#joinBySlugNick").val(localStorage.nickName);
    }

    manager = new XSockets.WebSocket(xsockets.url, xsockets.controller);
    
    manager.bind(XSockets.Events.open, function (conn) {
        account = new Account(manager, {
            currentId: localStorage.browserMeetingId,
            successLogin: function (profile) {
                localStorage.browserMeetingId = profile.Key;
                $(".navbar-form").hide();
                $("#jumbo a:last").tab("show");
                displayProfile(profile);
                account.updateProfile(profile);
            },
            failLogin: function (profile) {
                console.log("failLogin", profile);
            },
            profileCreated: function (profile) {
                localStorage.browserMeetingId = profile.Key;
            }
        });
        

        // Apply the KO model

        ko.applyBindings(account.ViewModel, document.querySelector("#myprofile"));
        
        window.setInterval(function () {
            manager.trigger(browserMeeting.meeting.Room + "heartbeat", {});
        }, 15 * 1000); // Heartbeat

        poker = new Poke(manager, conn.ClientGuid, function (p) {
            audio.play("poke");
            var el = $("<div><hr/><div><span class='label label-warning' style='margin-right:10px'>POKE!</span>Someone poked you ( wants to join this meeting/conference )<button style='margin-left:20px' class='btn btn-mini btn-success' data-state='true'>ACCEPT</button> <button class='btn btn-mini btn-warning' data-state='false'>DECLINE</button></div><hr/></div>")
                 .prependTo("#messages");

            $("button", el).each(function() {
                $(this).bind("click", { args: p }, function (evt) {
                    poker.reply($(this).data().state, evt.data.args.caller, currentRoom.Slug);
                    $(this).parent().parent().remove();
                });
            });

        }, function (response) {
            if(response.slug !== "")
            {
                $("#main,footer").hide();
                $("#room").hide();
                manager.trigger("GetRoomBySlug", {
                    slug: response.slug
                }, function () {
                    $("#loading").show();
                });
            } 
        });
        roomDrawer.init(map, function (poke) {
            audio.play("poke");
            poker.send(poke);
        });
        manager.bind("locationsChange", function (locations) {
            roomDrawer.redraw(locations);
        });
        
        browserMeeting = new BrowserMeeting(manager,conn,{audio:true,video:true});

        $("#loading").hide();
        manager.bind("onGetRoomResult", function (result) {
            $("#loading").hide();
            $("li.dropdown").fadeIn();
            
            if(result !== null)
            result.forEach(addToMyRooms);
            
            manager.trigger("statistics", {}, function () {
                $("#loading").hide();
            });
        });
        manager.bind("onStatistics", function (stats) {
            $("#loading").hide();
            $("#airtime").text(parseInt((stats.Airtime / 60) / 60));
            $("#numOfRooms").text(stats.Rooms);
            $("#totalPeers").text(stats.Peers);
            $(".stats").fadeIn();
        });

        // User is accessing by an "url" ?
        joinRoom =
        XSockets.Utils.getParameterByName("m") + XSockets.Utils.getParameterByName("M");

        if (joinRoom.length === 0) {
            $("#createRoom").on("click", function () {
                $("#room").hide();
                var roomId = $("#roomId").val();
                manager.trigger("addroom", {
                    caption: roomId,
                    url: baseUrl + "?roomId=" + roomId
                }, function () {
                    $("#loading").show();
                });
            });
        } else {
            $("#main,footer").hide();
            $("#room").hide();
            manager.trigger("GetRoomBySlug", {
                slug: joinRoom
            }, function () {
                $("#loading").show();
            });
        }
        
        manager.bind("onRoomAdd", function (result) {
            $("#loading").hide();
            account.ViewModel.Rooms.push(result);
            //currentRoom = result;
            //browserMeeting.joinRoom(result.Id, organizer, function () {
            //    $("#myRooms").hide();
            //    $(".you").fadeIn();
            //    $("#participants").fadeIn();
            //});
            //addToMyRooms(result);
        });
        
        manager.trigger("getRooms", {
        }, function () {
            $("#loading").show();
        });
        
    });
    manager.bind("onRoomAvailableResult", function (result) {
        if (result.IsAvailable) {
            $("#createRoom").fadeIn();
            $("#roomId").parent().parent().removeClass("error");
            $("#createRoom").removeAttr("disabled").text("Create Room");
        } else {
            {
                $("#roomId").parent().parent().addClass("error");
                $("#createRoom").removeAttr("disabled").text("Reserved room");
                $("#createRoom").attr("disabled", "disabled");
            }
        }
    });
    manager.bind("onGetRoomBySlugResult", function (r) {
        if (r.Room !== null) {
            $("#modalJoinLabel span").text(r.Room.Caption);
            $('#joinModal').modal('toggle');
            $("#join").bind("click", function () {
                $('#joinModal').modal('hide');
                currentRoom = r.Room;
                browserMeeting.joinRoom(r.Room.Id, joinNick, function () {
                    $("#main").fadeIn(function () {
                        $(".you").fadeIn(function () {
                            $("footer").fadeIn();
                            $("#participants").fadeIn();
                        });
                    });
                });
            });
        } else {
            $("#noRoom").modal("show");
            audio.play("error");
        }
    });
    $("video").live("mouseenter", function (evt) {
        $(this).attr("controls", "yes");
    }).live("mouseleave", function (evt) {
        $(this).removeAttr("controls");
    });
    $("#joinNick,#joinBySlugNick").bind("keyup", function () {
        joinNick = $(this).val();
        localStorage.nickName = joinNick;
    });
    $("#nickName").bind("keyup", function () {
        organizer = "Organizer ( " + $(this).val() + " )";
        localStorage.nickName = $(this).val();
    });
    $("#roomId").bind("keyup", function (evt) {
        var desiredName = $(this).val();
        if (!/^\w+$/.test(desiredName)) {
            evt.preventDefault();
            $(this).parent().parent().addClass("error");
            $("#createRoom").fadeOut();
        } else {
            manager.trigger("roomAvailable", {
                name: desiredName
            });
            $(this).parent().parent().removeClass("error");
        }
    });
    $("#joinSlug").bind("keyup", function (evt) {
        if ($(this).val().length >= 1) {
            $("#joinBySlug").removeAttr("disabled");
        } else {
            $("#joinBySlug").attr("disabled", "disabled");
        }
        if (evt.keyCode === 13) {
            evt.preventDefault();
            $("#joinBySlug").trigger("click");
        }
    });
    $("#joinBySlug").bind("click", function () {
        var slug = $("#joinSlug").val();
        $("#main,footer").hide();
        $("#room").hide();
        manager.trigger("GetRoomByCaption", {
            slug: slug
        }, function () {
            $("#loading").show();
        });
    });
    $("#createShare").one("click", function () {
        fileShare.create(browserMeeting.meeting.Room.Name, fileManager);
    });

    $(".removeRoom").live("click", function(evt) {
        evt.preventDefault();
        var self = this;
        manager.trigger("RemoveRoom", {
           Id: $(this).data().id
        }, function() {
            $(self).closest("tr").remove();
        });
    });

});


function displayProfile(p) {

    $("#lblProfileName").text(p.Name);
}

function addToMyRooms(room) {
    $("<li><a href='#'></a></li>").find("li").end().find("a").text(room.Caption).bind("click", {
        args: room
    }, function (evt) {
        evt.preventDefault();
        $("#myRooms").hide();
        currentRoom = evt.data.args;
        browserMeeting.joinRoom(evt.data.args.Id, organizer, function () {
            $("#loading").show();
            $("#room").hide();
            $(".you").fadeIn();
            $("#participants").fadeIn();
        });
    }).end().appendTo("#myRooms");
}

function onRemoteStream(obj) {
    $("#notstarted").fadeOut();
    var placeHolder = $("<div>").attr("id", obj.peerId).addClass("video").addClass("grow");
    var video = $("<video>").addClass("they");
    attachMediaStream(video.get(0), obj.streamEvent.stream);
    $(video).attr({
        autoplay: "autoplay",
        poster: "/content/images/balload.gif"
    });
    $(placeHolder).append(video);
    $("#videos").append(placeHolder);
}

function onRoomChange(peers) {
    audio.play("pling");
    $("#start").show();
    document.title = "(" + peers.length + ") " + currentRoom.Caption;
    $("#numOfPeers,#tabParticipantBadge").text(peers.length);
    $("#roomUrl").text(baseUrl + "?m=" + currentRoom.Slug).bind("click", function (evt) {
        evt.preventDefault();
    });
    $("#copytoclipboard").attr("data-clipboard-text", baseUrl + "?m=" + currentRoom.Slug + "&o=" + peers.length);
    $("#participants ul").empty();
    peers.forEach(function (peer) {
        $("<li><a href='#'></a>").find("a").attr("id", peer.Id).text(peer.NickName).end().appendTo("#participants ul");
    });
}
function onClientDisconnected(peerConnection) {
    $("div[id=" + peerConnection.Id + "]").fadeOut(function () {
        $(this).remove();
    });
    $("a[id=" + peerConnection.Id + "]").parent().fadeOut(function () {
        $(this).remove();
    });
    $("#participants ul").empty();
}


function onClientConnected(ws, client) {
    manager.trigger("setLocation", {
        city: geoip_city(),
        lat: geoip_latitude(),
        lng: geoip_longitude()
    });
   
    $("#notstarted").fadeIn();
    $("#createShare").show();
    fileShare = new FileShare(browserMeeting.meeting.Room, {
        url: "ws://webrtc.cloudapp.net/FileShareController",
        controller: "FileShareController",
        parameters: {}
    }, ws, function (offer) {
        fileShare.accept(offer, fileManager);
    }, function (blob) {
        var blobUrl = window.URL.createObjectURL(blob);
        var li = $("<li>");
        var download = $("<a>").text(fileInfo.name).attr({
            href: blobUrl,
            download: fileInfo.name
        });
        $(li).prepend(download).appendTo("#recivedFiles");
        $("#file").removeAttr("disabled");
        $("#fileShareBusy").hide();
    });
    manager.bind(browserMeeting.meeting.Room + "Notification", function (note) {
        notifications.createMessage(note.photo, note.nickName, note.message);
    });
    $(".bannerbg").fadeOut("slow", function () {
        $("#conference").addClass("gradient");
        $(".videoSize").show();
    });
    $("#localVideo").parent().attr("id", client.ClientGuid);
    $("#roomToolbox").fadeIn();
    $("#say").bind("keydown", function (evt) {
        if (evt.keyCode == 13) {
            evt.preventDefault();
            ws.trigger("chatMessage", {
                Nick: browserMeeting.meeting.NickName,
                Message: $("#say").val()
            });
            $("#say").val('');
        }
    });
    ws.bind("chatMessage", function (chatMessage) {
        audio.play("push"); // Notify that someone send a chatmessage...
        $("<p><strong></strong><span></span><p>").find("strong").text(chatMessage.Nick).end().
        find("span").html(chatMessage.Message.linkify()).end().prependTo("#messages");
    });
    window.setTimeout(function () {
        manager.trigger(browserMeeting.meeting.Room + "Notification", {
            photo: browserMeeting.takePicture("#localVideo", 80, 60),
            nickName: browserMeeting.meeting.NickName,
            message: "Enters the meeting..."
        });
    }, 1500);
}

function onLocalStream(stream) {
    $("#loading").hide();
    $("#videos").fadeIn();
    attachMediaStream($("#localVideo").get(0), stream);
}
var fileInfo = null;

function fileManager(channel) {
    $("#file,#createShare").toggle();
    document.querySelector("#file").addEventListener("change", function (evt) {
        var file = evt.target.files[0];
        var fileProp = {
            name: file.name,
            size: file.size,
            type: file.type
        };
        if (fileProp.size >= 5242880) {
            $("#fileShareError").fadeIn();
            return;
        } else {
            $("#fileShareError").hide();
        }
        channel.trigger("fileInfo", fileProp);
        var reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onloadend = function (blob) {
            window.setTimeout(function () {
                channel.send(blob.target.result);
            }, 3000);
        };
    });
    channel.bind("fileInfo", function (file) {
        $("#fileShareBusy span").text(file.name);
        $("#fileShareBusy").show();
        fileInfo = file;
        $("#file").attr("disabled", "disabled");
    });
}


