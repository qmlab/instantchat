
var MediaChannel = function(configs, constraints, socket) {
  this.configs = configs
  this.contraints = constraints
  this.signalingChannel = new SignalingChannel(socket, this)

  this.p2pOptions = { audio: false, video: false, isCaller: false, isMedia: false }
  this.pc
  this.inSession = false
  this.localStream
  this.remoteStream
  this.videoNode
  this.myVideoNode
  this.audioNode
  this.inSession = false

  // Callbacks
  this.onVideoStreamopen
  this.onVideoStreamclose
  this.onAudioStreamopen
  this.onAudioStreamclose
  this.createSrc = window.URL ? window.URL.createObjectURL : function(stream) {return stream}

  this.localDescCreated = function(desc) {
    if(this.p2pOptions.isMedia) {
      desc.sdp = preferOpus(desc.sdp)
    }
    else {
      desc.sdp = setSDPBandwidth(desc.sdp, 1024 * 1024)
    }
    this.pc.setLocalDescription(desc, (function () {
      this.signalingChannel.send({ 'sdp': this.pc.localDescription, 'to': this.p2pOptions.to, 'from': this.p2pOptions.from, 'isMedia': this.p2pOptions.isMedia, 'audio': this.p2pOptions.audio, 'video': this.p2pOptions.video})
    }).bind(this), logError)
  }

  this.loadMediaError = function(e) {
    logError(e)
    if (this.p2pOptions.isMedia) {
      if (this.p2pOptions.video) {
        this.onVideoStreamclose()
      }
      else if (p2pOptions.audio) {
        this.onAudioStreamclose()
      }
    }
  }

  this.stopSession = function(keepAlive) {
    if (!!this.localStream) {
      this.localStream.stop()
      this.localStream = undefined
    }
    if (!!this.remoteStream) {
      this.remoteStream.stop()
      this.remoteStream = undefined
    }
    if (this.pc.signalingState !== 'closed') {
      if (!keepAlive) {
        this.pc.close()
      }
    }
    this.inSession = false
    this.p2pOptions.isCaller = false
    this.p2pOptions.isMedia = false
  }

  // call start() to initiate
  this.start = function() {
    this.pc = new RTCPeerConnection(this.configs, this.contraints)

    // send any ice candidates to the other peer
    this.pc.onicecandidate = (function (evt) {
      if (evt.candidate) {
        this.signalingChannel.send({ 'candidate': evt.candidate, 'to': this.p2pOptions.to, 'from': this.p2pOptions.from })
      }
    }).bind(this)

    // let the 'negotiationneeded' event trigger offer generation
    this.pc.onnegotiationneeded = (function () {
      this.pc.createOffer(this.localDescCreated.bind(this), logError)
    }).bind(this)

    // once remote stream arrives, show it in the remote video element
    this.pc.onaddstream = (function (evt) {
      console.log('adding remote stream')
      if (this.p2pOptions.video)
      {
        this.onVideoStreamopen(evt)
        this.videoNode.src = URL.createObjectURL(evt.stream)
        this.videoNode.play()
        this.remoteStream = evt.stream
      }
      else if (this.p2pOptions.audio)
      {
        this.onAudioStreamopen(evt)
        this.audioNode.src = URL.createObjectURL(evt.stream)
        this.audioNode.play()
        this.remoteStream = evt.stream
      }
      else {
        return
      }
    }).bind(this)

    this.pc.oniceconnectionstatechange = (function (evt) {
      console.log('oniceconnectionstatechange: ' + this.pc.iceConnectionState)
      if (this.pc.iceConnectionState === 'disconnected') {
        this.stopSession()
        if (this.p2pOptions.video) {
          this.onVideoStreamclose(evt)
        }
        else if (this.p2pOptions.audio) {
          this.onAudioStreamclose(evt)
        }
      }
    }).bind(this)

    this.pc.onsignalingstatechange = (function (evt) {
      console.log('onsignalingstatechange: ' + this.pc.signalingState)
    }).bind(this)

    if (this.p2pOptions.isMedia) {
      // get a local stream, show it in a self-view and add it to be sent
      navigator.getUserMedia({ 'audio': this.p2pOptions.audio, 'video': this.p2pOptions.video }, (function (stream) {
        if (this.p2pOptions.video) {
          this.myVideoNode.src = this.createSrc(stream)

          // Noise control
          this.myVideoNode.volume = 0

          this.myVideoNode.play()
        }
        this.localStream = stream
        this.pc.addStream(stream)
      }).bind(this), this.loadMediaError)
    }
  }
}

MediaChannel.prototype.startVideo = function(to, from) {
  this.p2pOptions.audio = true
  this.p2pOptions.video = true
  this.p2pOptions.to = to
  this.p2pOptions.from = from
  this.p2pOptions.isCaller = true
  this.p2pOptions.isMedia = true
  this.onVideoStreamopen()
  this.start()
}

MediaChannel.prototype.startAudio = function(to, from) {
  this.p2pOptions.audio = true
  this.p2pOptions.video = false
  this.p2pOptions.to = to
  this.p2pOptions.from = from
  this.p2pOptions.isCaller = true
  this.p2pOptions.isMedia = true
  this.onAudioStreamopen()
  this.start()
}

MediaChannel.prototype.stopVideo = function () {
  if(!!this.localStream) {
    this.myVideoNode.pause()
  }
  if(!!this.remoteStream) {
    this.videoNode.pause()
  }
  this.stopSession()
  this.onVideoStreamclose()
}

MediaChannel.prototype.stopAudio = function () {
  this.audioNode.pause()
  this.stopSession()
  this.onAudioStreamclose()
}

MediaChannel.prototype.muteMe = function () {
  this.localStream.getAudioTracks()[0].enabled = state
}

MediaChannel.prototype.onmessage = function(message) {
  if (!this.pc || this.pc.iceConnectionState === 'closed') {
    if (!this.inSession) {
      this.inSession = true
      this.p2pOptions.audio = message.audio
      this.p2pOptions.video = message.video
      this.p2pOptions.to = message.from
      this.p2pOptions.from = message.to
      this.p2pOptions.isMedia = message.isMedia
      this.start()
    }
  }

  if (!!message.sdp) {
    this.pc.setRemoteDescription(new RTCSessionDescription(message.sdp), (function () {
      // if we received an offer, we need to answer
      if (this.pc.remoteDescription.type == 'offer') {
        this.pc.createAnswer(this.localDescCreated.bind(this), logError)
      }
    }).bind(this), logError)
  }
  else if (!!message.candidate){
    this.pc.addIceCandidate(new RTCIceCandidate(message.candidate), logSuccess, logError)
  }
}
