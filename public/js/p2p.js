var configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]}
var p2pOptions = { audio: true, video: false, roomname: "1", username: "a"}
var pc
, signalingChannel
, currentStream
, $audioNode
, $myVideoNode
, $theirVideoNode

// call start() to initiate
function start() {
  pc = new RTCPeerConnection(configuration)

  // send any ice candidates to the other peer
  pc.onicecandidate = function (evt) {
    if (evt.candidate) {
      signalingChannel.send({ "candidate": evt.candidate, "username": p2pOptions.username, "roomname": p2pOptions.roomname });
    };
  }

  // let the "negotiationneeded" event trigger offer generation
  pc.onnegotiationneeded = function () {
    pc.createOffer(localDescCreated, logError);
  }

  // once remote stream arrives, show it in the remote video element
  pc.onaddstream = function (evt) {
    $audioNode.src = URL.createObjectURL(evt.stream);
    currentStream = evt.stream
  };

  // get a local stream, show it in a self-view and add it to be sent
  navigator.getUserMedia({ "audio": p2pOptions.audio, "video": p2pOptions.video }, function (stream) {
    if (p2pOptions.video) {
      $myVideoNode.src = URL.createObjectURL(stream);
    }
    currentStream = stream
    pc.addStream(stream);
  }, logError);
}

function localDescCreated(desc) {
  pc.setLocalDescription(desc, function () {
    signalingChannel.send({ "sdp": pc.localDescription, "username": p2pOptions.username, "roomname": p2pOptions.roomname });
  }, logError);
}

function setupReceiver() {
  signalingChannel.onmessage = function (message) {
    if (!pc) {
      start();
      p2pOptions.audio = message.audio;
      p2pOptions.video = message.video;
      p2pOptions.roomname = null;
      p2pOptions.username = null;
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
      pc.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  }
}

function logError(error) {
  log(error.name + ": " + error.message);
}
