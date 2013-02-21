XSockets.WebRTC.Conference.ScreenSharing
=======================================

# About

This repo contains the source code (frontend) for the "WebRTC ScreenCapture" demo found at https://screensharing.azurewebsites.net/
It uses the navigator.getUserMedia() API extensions to do screen capturing, also note that is this is true screen sharing and not tab content sharing. 

The demo supports multiple participants, and the clients can choose between screen sharing and webcam/mic.

# Important
To run this demo ensure that your site us running under SSL ( https ). WebRTC ScrenCapture only seems to work under that scheme.
You will need Chrome 26+ with "Enable screen capture support in getUserMedia()" turned on in about:flags or --enable-usermedia-screen-capturin flag set.


Regards
Team Xsockets.NET