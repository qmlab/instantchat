var CHUNKSIZE = 1024;
var CHUNKBUFFERSIZE = 100;
var mime = 'text/html'

var DataChannel = function(configs, constraints, socket) {
  var type = 'data'

  this.configs = configs
  this.contraints = constraints
  this.signalingChannel = new SignalingChannel(socket, type, this)

  this.p2pOptions = { audio: false, video: false, isCaller: false }
  this.pc
  this.inSession = false
  this.channel

  // Callbacks
  this.onchannelopen
  this.onchannelmessage
  this.onchannelclose
  this.onchannelerror

  // Private counter
  this.numOfFunctionCalls = 0; // Prevent stack from being too deep

  // Timer
  this.startTimes = {}

  this.localDescCreated = function(desc) {
    desc.sdp = setSDPBandwidth(desc.sdp, 1024 * 1024)
    this.pc.setLocalDescription(desc, (function () {
      this.signalingChannel.send({ 'type': type, 'sdp': this.pc.localDescription, 'to': this.p2pOptions.to, 'from': this.p2pOptions.from, 'audio': this.p2pOptions.audio, 'video': this.p2pOptions.video})
    }).bind(this), logError)
  }

  // Data channel
  this.setupDataChannelEvents = function() {
    this.channel.onopen = this.onchannelopen
    this.channel.onmessage = this.onchannelmessage
    this.channel.onclose = this.onchannelclose
    this.channel.onerror = this.onchannelerror
  }

  this.onReadAsDataURL = function(event, text, filename, log) {
    this.numOfFunctionCalls++;
    var data = {}; // data object to transmit over data channel

    if (event) text = event.target.result; // on first invocation

    data.filename = filename
    if (text.length > CHUNKSIZE) {
      data.message = text.slice(0, CHUNKSIZE); // getting chunk using predefined chunk length
    } else {
      data.message = text;
      data.last = true;
    }

    this.sendData(JSON.stringify(data), (function() {
      var remainingDataURL = text.slice(data.message.length);
      if (remainingDataURL.length) {
        if (this.numOfFunctionCalls % 100 === 0) {
          setTimeout((function() { this.onReadAsDataURL(null, remainingDataURL, data.filename); }).bind(this), 10)
        }
        else {
          this.onReadAsDataURL(null, remainingDataURL, data.filename);
        }
      }
      else {
        this.stopSession(true)
        var endTime = new Date()
        var elapsedTime = (endTime - this.startTimes[filename]) / 1000
        var msg = 'file "' + filename + '" transfer completed in ' + elapsedTime + 's.'
        if (!!log) {
          log(msg)
        }
      }
    }).bind(this))
  }

  this.stopSession = function(keepAlive) {
    if (!!this.channel) {
      if (!keepAlive) {
        this.channel.close()
        this.channel = undefined
      }
    }
    if (this.pc.signalingState !== 'closed') {
      if (!keepAlive) {
        this.pc.close()
      }
    }
    this.inSession = false
    this.p2pOptions.isCaller = false
  }

  this.start = function() {
    this.pc = new RTCPeerConnection(this.configs, this.contraints)

    // send any ice candidates to the other peer
    this.pc.onicecandidate = (function (evt) {
      if (evt.candidate) {
        this.signalingChannel.send({ 'type': type, 'candidate': evt.candidate, 'to': this.p2pOptions.to, 'from': this.p2pOptions.from })
      }
    }).bind(this)

    // let the 'negotiationneeded' event trigger offer generation
    this.pc.onnegotiationneeded = (function () {
      this.pc.createOffer(this.localDescCreated.bind(this), logError)
    }).bind(this)

    this.pc.oniceconnectionstatechange = (function (evt) {
      console.log('oniceconnectionstatechange: ' + this.pc.iceConnectionState)
      if (this.pc.iceConnectionState === 'disconnected') {
        this.stopSession()
      }
    }).bind(this)

    this.pc.onsignalingstatechange = (function (evt) {
      console.log('onsignalingstatechange: ' + this.pc.signalingState)
    }).bind(this)

    this.pc.ondatachannel = (function (evt) {
      this.channel = evt.channel
      this.setupDataChannelEvents()
    }).bind(this)
  }
}

DataChannel.prototype.sendData = function(data, callback) {
  var readyState = this.channel.readyState
  if (readyState == 'open') {
    this.channel.send(data)
    callback(data)
  }
}

// evt - FileReader onload event
DataChannel.prototype.sendFile = function(evt, filename, log) {
  this.startTimes[filename] = new Date()
  if (typeof this.channel != 'undefined' && this.channel.target !== this.p2pOptions.to) {
    this.onchannelclose = (function(e) {
      console.log('channel onclose:' + e)
      this.onchannelopen = (function() {
        if (this.p2pOptions.isCaller) {
          console.log('channel onopen')
          this.onReadAsDataURL(evt, null, filename, log)
        }
      }).bind(this)
      this.start()
      this.onchannelclose = function(e) {
        console.log('channel onclose:' + e)
      }
    }).bind(this)

    this.stopSession()
  }
  else if (!this.channel) {
    this.onchannelopen = (function() {
      if (this.p2pOptions.isCaller) {
        console.log('channel onopen')
        this.onReadAsDataURL(evt, null, filename, log)
      }
    }).bind(this)
    this.start()
  }
  else {
    this.onReadAsDataURL(evt, null, filename, log)
  }
}


DataChannel.prototype.onmessage = function(message) {
  if (!this.pc || this.pc.iceConnectionState === 'closed') {
    if (!this.inSession) {
      this.inSession = true
      this.p2pOptions.audio = message.audio
      this.p2pOptions.video = message.video
      this.p2pOptions.to = message.from
      this.p2pOptions.from = message.to
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
