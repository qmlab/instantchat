var CHUNK_SIZE = 1200;
var CHUNK_BUFFER_SIZE = 100;
var CACHE_SIZE = 100000000;
var CALLBACK_DELAY = 100;
var MIME = 'text/html'

//read a slice the size not bigger than CACHE_SIZE,100MB since ~100MB is the limit for read size of file api (in chrome).
var chunksPerSlice = Math.floor(Math.min(1024000,CACHE_SIZE,100000000)/CHUNK_SIZE);
//var swID;
var sliceSize = chunksPerSlice * CHUNK_SIZE;

var DataChannel = function(configs, constraints, socket) {
  var type = 'data'

  this.configs = configs
  this.contraints = constraints
  this.signalingChannel = new SignalingChannel(socket, type, this)

  this.p2pOptions = { audio: false, video: false, isCaller: false }
  this.pc
  this.inSession = false
  this.channel
  this.chunks = []
  this.blobs = []

  // Callbacks
  this.onchannelopen
  this.onchannelclose
  this.onchannelerror
  this.onchannelmessage = function (event) {
    var data = JSON.parse(event.data);
    var content = common.util.convert.decode(data.message)
    this.chunks = this.chunks.concat(content); // pushing chunks in array
    if (this.chunks.length > CHUNK_BUFFER_SIZE || data.last) {
      this.blobs.push(new Blob(this.chunks, {type: MIME}))
      this.chunks = []
      console.log('created blob')
    }

    if (data.last) {
      var finalBlob = new Blob(this.blobs, {type: MIME})
      console.log('final blob created')
      saveToDisk(URL.createObjectURL(finalBlob), data.filename);
      this.blobs = []
      this.stopSession(true)
    }
  }


  // Private counter
  this.numOfFunctionCalls = 0; // Prevent stack from being too deep

  // Timer
  this.startTimes = {}

  this.sliceId = 0
  this.blob

  this.localDescCreated = function(desc) {
    desc.sdp = setSDPBandwidth(desc.sdp, 1024 * 1024)
    this.pc.setLocalDescription(desc, (function () {
      this.signalingChannel.send({ 'type': type, 'sdp': this.pc.localDescription, 'to': this.p2pOptions.to, 'from': this.p2pOptions.from, 'audio': this.p2pOptions.audio, 'video': this.p2pOptions.video})
    }).bind(this), logError)
  }

  // Data channel
  this.setupDataChannelEvents = function() {
    this.channel.onopen = this.onchannelopen.bind(this)
    this.channel.onmessage = this.onchannelmessage.bind(this)
    this.channel.onclose = this.onchannelclose.bind(this)
    this.channel.onerror = this.onchannelerror.bind(this)
    this.channel.chunks = [];
    this.channel.blobs = [];
  }

  this.chunkAndTransfer = function(reader, text, file, log, isLastSlice) {
    this.numOfFunctionCalls++;
    var data = {}; // data object to transmit over data channel


    data.filename = file.name
    if (text.length > CHUNK_SIZE) {
      data.message = text.slice(0, CHUNK_SIZE); // getting chunk using predefined chunk length
    } else {
      data.message = text;
      if (isLastSlice) {
        data.last = true;
      }
    }

    this.sendData(JSON.stringify(data), (function() {
      var remainingOfSlice = text.slice(data.message.length);
      if (remainingOfSlice.length) {
        this.chunkAndTransfer(reader, remainingOfSlice, file, log, isLastSlice)
      }
      else {
        this.sliceId++;
        if ((this.sliceId + 1) * sliceSize < file.size) {
          this.blob = file.slice(this.sliceId * sliceSize, (this.sliceId + 1) * sliceSize);
          reader.readAsArrayBuffer(this.blob);
        } else if (this.sliceId * sliceSize < file.size) {
          this.blob = file.slice(this.sliceId * sliceSize, file.size);
          reader.readAsArrayBuffer(this.blob);
        } else {
          this.finishedLoadingFile(file, log);
        }
      }
    }).bind(this))
  }

  this.finishedLoadingFile = function(file, log) {
    var endTime = new Date()
    var elapsedTime = (endTime - this.startTimes[file.name]) / 1000
    var msg = 'file "' + file.name + '" transfer completed in ' + elapsedTime + 's.'
    if (!!log) {
      log(msg)
    }
    this.stopSession(true)
  }


  this.sendFileInternal = function (file, log) {
    this.startTimes[file.name] = new Date()
    var reader = new FileReader();
    this.sliceId = 0

    var fails = 0
    var text
    reader.onloadend = (function (evt) {
      if (evt) {
        text = common.util.convert.encode(evt.target.result); // on first invocation
      }
      if (evt.target.readyState == FileReader.DONE) { // DONE == 2
        fails = 0
        this.chunkAndTransfer(evt.target, text, file, log, this.blob.size < sliceSize)
      }
      else if (fails < 10) {
        fails++
        setTimeout(this.chunkAndTransfer(evt.target, text, file, log, this.blob.size < sliceSize).bind(this), fails * CALLBACK_DELAY)
      }
      else {
        alert('Failed to send file ' + file.name)
        fails = 0
      }

    }).bind(this)

    this.blob = file.slice(this.sliceId * sliceSize, (this.sliceId + 1) * sliceSize);
    reader.readAsArrayBuffer(this.blob);
  }

  this.stopSession = function(keepAlive) {
    if (!!this.channel) {
      if (!keepAlive) {
        this.channel.close()
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

    if (this.p2pOptions.isCaller) {
      this.channel = this.pc.createDataChannel('interdata', { reliable: false })
      this.channel.target = this.p2pOptions.to
      this.setupDataChannelEvents()
    }
    else {
      this.pc.ondatachannel = (function (evt) {
        this.channel = evt.channel
        this.channel.target = this.p2pOptions.from
        this.setupDataChannelEvents()
      }).bind(this)
    }
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
DataChannel.prototype.sendFile = function(file, log) {
  if (this.inSession) {
    log('File transfer failed - already sending/receiving a file')
    return
  }
  else {
    this.inSession = true
  }

  if (typeof this.channel != 'undefined' && this.channel.target !== this.p2pOptions.to) {
    if (this.channel.target !== this.p2pOptions.from) {
      // Reopen the channel for a different partner
      this.onchannelclose = (function(e) {
        console.log('channel onclose:' + e)
        this.onchannelopen = (function() {
          console.log('channel onopen')
          this.sendFileInternal(file, log)
        }).bind(this)
        this.start()
        this.onchannelclose = function(e) {
          console.log('channel onclose:' + e)
        }
        this.setupDataChannelEvents()
      }).bind(this)

      this.setupDataChannelEvents()
      this.stopSession()
      this.p2pOptions.isCaller = true
    }
    else {
      // Keep alive for traffic in the same channel
      this.stopSession(true)
      this.p2pOptions.isCaller = true
      this.sendFileInternal(file, log)
    }
  }
  else if (!this.channel) {
    this.p2pOptions.isCaller = true
    this.onchannelopen = (function() {
      console.log('channel onopen')
      this.sendFileInternal(file, log)
    }).bind(this)

    this.start()
  }
  else {
    this.p2pOptions.isCaller = true
    this.sendFileInternal(file, log)
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

DataChannel.prototype.getPeer = function() {
  return this.p2pOptions.to
}
