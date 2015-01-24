initConfigs(null)

var p2pOptions = { audio: true, video: true, isCaller: false, isMedia: false }
var pc
, signalingChannel
, localStream
, remoteStream
, videoNode
, myVideoNode
, audioNode
, inSession = false
, channel
// Callbacks
, onchannelopen
, onchannelmessage
, onchannelclose
, onchannelerror
, onVideoStreamopen
, onVideoStreamclose
, onAudioStreamopen
, onAudioStreamclose

var createSrc = window.URL ? window.URL.createObjectURL : function(stream) {return stream}

// call start() to initiate
function start() {
  pc = new RTCPeerConnection(configs, contraints)

  // send any ice candidates to the other peer
  pc.onicecandidate = function (evt) {
    if (evt.candidate) {
      signalingChannel.send({ 'candidate': evt.candidate, 'to': p2pOptions.to, 'from': p2pOptions.from })
    }
  }

  // let the 'negotiationneeded' event trigger offer generation
  pc.onnegotiationneeded = function () {
    pc.createOffer(localDescCreated, logError)
  }

  // once remote stream arrives, show it in the remote video element
  pc.onaddstream = function (evt) {
    console.log('adding remote stream')
    if (p2pOptions.video)
    {
      onVideoStreamopen(evt)
      videoNode.src = URL.createObjectURL(evt.stream)
      videoNode.play()
      remoteStream = evt.stream
    }
    else if (p2pOptions.audio)
    {
      onAudioStreamopen(evt)
      audioNode.src = URL.createObjectURL(evt.stream)
      audioNode.play()
      remoteStream = evt.stream
    }
    else {
      return
    }
  }

  pc.oniceconnectionstatechange = function (evt) {
    console.log('oniceconnectionstatechange: ' + pc.iceConnectionState)
    if (pc.iceConnectionState === 'disconnected') {
      stopSession()
      if (p2pOptions.video) {
        onVideoStreamclose(evt)
      }
      else if (p2pOptions.audio) {
        onAudioStreamclose(evt)
      }
    }
  }

  pc.onsignalingstatechange = function (evt) {
    console.log('onsignalingstatechange: ' + pc.signalingState)
  }

  if (p2pOptions.isMedia) {
    // get a local stream, show it in a self-view and add it to be sent
    navigator.getUserMedia({ 'audio': p2pOptions.audio, 'video': p2pOptions.video }, function (stream) {
      if (p2pOptions.video) {
        myVideoNode.src = createSrc(stream)
        myVideoNode.play()
      }
      localStream = stream
      pc.addStream(stream)
    }, loadMediaError)
  }
  else {
    if (p2pOptions.isCaller) {
      channel = pc.createDataChannel('interdata', { reliable: false })
      setupDataChannelEvents()
    }
    else {
      pc.ondatachannel = function (evt) {
        channel = evt.channel
        setupDataChannelEvents()
      }
    }
  }
}

function localDescCreated(desc) {
  if (p2pOptions.isCaller && p2pOptions.isMedia) {
    desc.sdp = preferOpus(desc.sdp)
  }
  pc.setLocalDescription(desc, function () {
    signalingChannel.send({ 'sdp': pc.localDescription, 'to': p2pOptions.to, 'from': p2pOptions.from, 'isMedia': p2pOptions.isMedia, 'audio': p2pOptions.audio, 'video': p2pOptions.video})
  }, logError)
}

function loadMediaError(e) {
  logError(e)
  if (p2pOptions.isMedia) {
    if (p2pOptions.video) {
      onVideoStreamclose()
    }
    else if (p2pOptions.audio) {
      onAudioStreamclose()
    }
  }
}

function stopSession() {
  if (!!localStream) {
    localStream.stop()
    localStream = undefined
  }
  if (!!remoteStream) {
    remoteStream.stop()
    remoteStream = undefined
  }
  if (!!channel) {
    channel.close()
    channel = undefined
  }
  if (pc.signalingState !== 'closed') {
    pc.close()
  }
  inSession = false
  p2pOptions.isCaller = false
  p2pOptions.isMedia = false
}

function SignalingChannel(socket) {
  this.socket = socket
  this.socket.on('receive signal', this.onmessage)
}

SignalingChannel.prototype.send = function(data) {
  this.socket.emit('send signal', data)
}

SignalingChannel.prototype.onmessage = function (message) {
  if (!pc || pc.iceConnectionState === 'closed') {
    if (!inSession) {
      inSession = true
      p2pOptions.audio = message.audio
      p2pOptions.video = message.video
      p2pOptions.to = message.from
      p2pOptions.from = message.to
      p2pOptions.isMedia = message.isMedia
      start()
    }
  }

  if (!!message.sdp) {
    pc.setRemoteDescription(new RTCSessionDescription(message.sdp), function () {
      // if we received an offer, we need to answer
      if (pc.remoteDescription.type == 'offer') {
        pc.createAnswer(localDescCreated, logError)
      }
    }, logError)
  }
  else if (!!message.candidate){
    pc.addIceCandidate(new RTCIceCandidate(message.candidate), logSuccess, logError)
  }
}

// Data channel
function setupDataChannelEvents() {
  channel.onopen = onchannelopen
  channel.onmessage = onchannelmessage
  channel.onclose = onchannelclose
  channel.onerror = onchannelerror
}

function sendChatMessage(msg, callback) {
  var readyState = channel.readyState
  if (readyState == 'open') {
    channel.send(msg)
    callback()
  }
}
