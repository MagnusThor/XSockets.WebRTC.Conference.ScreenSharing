var Audio = function () {
    var audioBuffers = {};
    var context = new webkitAudioContext();
    this.load = function (key, url) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.onload = function () {
            context.decodeAudioData(request.response, function (buffer) {
                audioBuffers[key] = buffer;
            }, function () { });
        };
        request.send();
    };
    this.play = function (key) {
        var source = context.createBufferSource();
        source.buffer = audioBuffers[key];
        source.connect(context.destination);
        source.noteOn(0);
    };
};