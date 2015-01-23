var configuration = {"iceServers":[{"url": "stun:stun.l.google.com:19302"}]}

var p2pOptions = { audio: true, video: true, isCaller: false, isMedia: false }
var pc
, signalingChannel
, currentStream
, videoNode
, myVideoNode
, inSession = false
, channel
, onchannelopen
, onchannelmessage

var createSrc = window.URL ? window.URL.createObjectURL : function(stream) {return stream;};

// call start() to initiate
function start() {
  pc = new RTCPeerConnection(configuration)

  // send any ice candidates to the other peer
  pc.onicecandidate = function (evt) {
    if (evt.candidate) {
      signalingChannel.send({ "candidate": evt.candidate, "to": p2pOptions.to, "from": p2pOptions.from, "isMedia": p2pOptions.isMedia});
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
      stopSession()
    }
  }

  if (p2pOptions.isMedia) {
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
  else {
    if (p2pOptions.isCaller) {
      channel = pc.createDataChannel('interdata')
      setupChat()
    }
    else {
      pc.ondatachannel = function (evt) {
        channel = evt.channel
        setupChat()
      }
    }
  }
}

function localDescCreated(desc) {
  if (p2pOptions.isCaller && p2pOptions.isMedia) {
    desc.sdp = setOneWay(preferOpus(desc.sdp))
  }
  pc.setLocalDescription(desc, function () {
    signalingChannel.send({ "sdp": pc.localDescription, "to": p2pOptions.to, "from": p2pOptions.from});
  }, logError);
}

function stopSession() {
  if (!!currentStream) {
    currentStream.stop()
  }
  inSession = false
  p2pOptions.isCaller = false
  p2pOptions.isMedia = false
  pc.close()
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
      p2pOptions.isMedia = message.isMedia
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

function setupChat() {
  channel.onopen = onchannelopen
  channel.onmessage = onchannelmessage
}

function sendChatMessage(msg) {
  channel.send(msg)
}
