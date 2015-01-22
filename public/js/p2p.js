var configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]}
var p2pOptions = { audio: false, video: true, isCaller: false}
var pc
, signalingChannel
, currentStream
, videoNode
, myVideoNode
, inSession = false

var createSrc = window.URL ? window.URL.createObjectURL : function(stream) {return stream;};

// call start() to initiate
function start() {
  pc = new RTCPeerConnection(configuration)

  // send any ice candidates to the other peer
  pc.onicecandidate = function (evt) {
    if (evt.candidate) {
      signalingChannel.send({ "candidate": evt.candidate, "to": p2pOptions.to, "from": p2pOptions.from});
    };
  }

  // let the "negotiationneeded" event trigger offer generation
  pc.onnegotiationneeded = function () {
    pc.createOffer(localDescCreated, logError);
  }

  // once remote stream arrives, show it in the remote video element
  pc.onaddstream = function (evt) {
    videoNode.src = URL.createObjectURL(evt.stream);
    videoNode.play()
    currentStream = evt.stream
  };

  pc.oniceconnectionstatechange = function (evt) {
    console.log('oniceconnectionstatechange: ' + evt)
    if (pc.iceConnectionState === 'disconnected') {
      closeSession()
    }
  }

  if (p2pOptions.isCaller) {
    // get a local stream, show it in a self-view and add it to be sent
    navigator.getUserMedia({ "audio": p2pOptions.audio, "video": p2pOptions.video }, function (stream) {
      if (p2pOptions.video) {
        myVideoNode.src = createSrc(stream)
        myVideoNode.play()
      }
      currentStream = stream
      pc.addStream(stream);
    }, logError);
  }
}

function localDescCreated(desc) {
  desc.sdp = setOneWay(preferOpus(desc.sdp))
  pc.setLocalDescription(desc, function () {
    signalingChannel.send({ "sdp": pc.localDescription, "to": p2pOptions.to, "from": p2pOptions.from});
  }, logError);
}

function stopSession() {
  if (!!currentStream) {
    currentStream.stop()
  }
  inSession = false
}

function logError(error) {
  console.log('error:' + error)
}

function logSuccess(msg) {
  console.log('success:' + msg)
}

function SignalingChannel(socket) {
  this.socket = socket
  this.socket.on('receive signal', this.onmessage)
}

SignalingChannel.prototype.send = function(data) {
  this.socket.emit('send signal', data)
}

SignalingChannel.prototype.onmessage = function (message) {
  if (!inSession) {
    inSession = true;
    if (!pc) {
      start();
      p2pOptions.audio = message.audio;
      p2pOptions.video = message.video;
      p2pOptions.to = message.to;
      p2pOptions.from = message.from;
    }

    if (message.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), function () {
        // if we received an offer, we need to answer
        if (pc.remoteDescription.type == "offer") {
          pc.createAnswer(localDescCreated, logError);
        }
      }, logError);
    }
    else {
      pc.addIceCandidate(new RTCIceCandidate(message.candidate), logSuccess, logError);
    }
  }
}


var setOneWay = function(sdp) {
  var sdpLines = sdp.split('\r\n');

  for (var i = 0; i < sdpLines.length; i++) {
    sdpLines[i] = sdpLines[i].replace(/^a=sendrecv/i, 'a=sendonly')
  }

  sdp = sdpLines.join('\r\n');
  return sdp;
};

var preferOpus = function(sdp) {
  var sdpLines = sdp.split('\r\n');

  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      var mLineIndex = i;
      break;
    }
  }

  if (typeof mLineIndex !== 'undefined') {
    for (i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('opus/48000') !== -1) {
        var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
        if (opusPayload) {
          sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
        }
        break;
      }
    }

    sdpLines = removeCN(sdpLines, mLineIndex);
  }

  sdp = sdpLines.join('\r\n');
  return sdp;
};

var extractSdp = function(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return (result && result.length == 2)? result[1]: null;
};

var setDefaultCodec = function(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = new Array();
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) newLine[index++] = payload;
    if (elements[i] !== payload) newLine[index++] = elements[i];
  }
  return newLine.join(' ');
};

var removeCN = function(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) mLineElements.splice(cnPos, 1);
      sdpLines.splice(i, 1);
    }
  }
  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
};
