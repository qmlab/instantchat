var CHUNKSIZE = 1200;
var CHUNKBUFFERSIZE = 100;
var CACHESIZE = 100000000;
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
  this.onchannelclose
  this.onchannelerror
  this.onchannelmessage = function (event) {
    var data = JSON.parse(event.data);
    var content = common.util.convert.decode(data.message)
    var blobCount = 0;
    this.chunks = this.chunks.concat(content); // pushing chunks in array
    if (this.chunks.length > CHUNKBUFFERSIZE || data.last) {
      this.blobs.push(new Blob(this.chunks, {type: mime}))
      this.chunks = []
      console.log('created blob ' + blobCount)
      blobCount++
    }

    if (data.last) {
      var finalBlob = new Blob(this.blobs, {type: mime})
      console.log('final blob created')
      saveToDisk(URL.createObjectURL(finalBlob), data.filename);
      this.blobs = []
    }
  }


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
    this.channel.chunks = [];
    this.channel.blobs = [];
  }

  this.chunkAndTransfer = function(event, text, filename, log, isLastSlice, callback) {
    this.numOfFunctionCalls++;
    var data = {}; // data object to transmit over data channel

    if (event) {
      text = common.util.convert.encode(event.target.result); // on first invocation
    }

    data.filename = filename
    if (text.length > CHUNKSIZE) {
      data.message = text.slice(0, CHUNKSIZE); // getting chunk using predefined chunk length
    } else {
      data.message = text;
      if (isLastSlice) {
        data.last = true;
      }
    }

    this.sendData(JSON.stringify(data), (function() {
      var remainingSlice = text.slice(data.message.length);
      if (remainingSlice.length) {
        /*if (this.numOfFunctionCalls % 100 === 0) {
          setTimeout((function() { this.chunkAndTransfer(null, remainingSlice, data.filename, log, isLastSlice, callback).bind(this)}).bind(this), 10)
        }
        else {*/
        this.chunkAndTransfer(null, remainingSlice, data.filename, log, isLastSlice, callback)
        //}
      }
      else {
        if (!!callback) {
          setTimeout(callback.bind(this), 750)
        }
      }
    }).bind(this))
  }

  this.finishedLoadingFile = function(file, log) {
    this.stopSession(true)
    var endTime = new Date()
    var elapsedTime = (endTime - this.startTimes[file.name]) / 1000
    var msg = 'file "' + file.name + '" transfer completed in ' + elapsedTime + 's.'
    if (!!log) {
      log(msg)
    }
  }

  this.sendFileInternal = function (file, log) {
    this.startTimes[file.name] = new Date()
    var reader = new FileReader();
    var sliceId = 0
    var sliceSize = CHUNKSIZE
    //read a slice the size not bigger than CACHESIZE,100MB since ~100MB is the limit for read size of file api (in chrome).
    var chunksPerSlice = Math.floor(Math.min(1024000,CACHESIZE,100000000)/CHUNKSIZE);
    //var swID;
    var sliceSize = chunksPerSlice * CHUNKSIZE;
    reader.onloadend = (function (evt) {
      if (evt.target.readyState == FileReader.DONE) { // DONE == 2
        this.chunkAndTransfer(evt, null, file.name, log, blob.size < sliceSize, (function(){
          sliceId++;
          if ((sliceId + 1) * sliceSize < file.size) {
            blob = file.slice(sliceId * sliceSize, (sliceId + 1) * sliceSize);
            reader.readAsArrayBuffer(blob);
          } else if (sliceId * sliceSize < file.size) {
            blob = file.slice(sliceId * sliceSize, file.size);
            reader.readAsArrayBuffer(blob);
          } else {
            this.finishedLoadingFile(file, log);
          }
        }).bind(this))
      }
    }).bind(this)

    blob = file.slice(sliceId * sliceSize, (sliceId + 1) * sliceSize);
    reader.readAsArrayBuffer(blob);
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

    if (this.p2pOptions.isCaller) {
      this.channel = this.pc.createDataChannel('interdata', { reliable: false })
      this.channel.target = this.p2pOptions.to
      this.setupDataChannelEvents()
    }
    else {
      this.pc.ondatachannel = (function (evt) {
        this.channel = evt.channel
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
  if (typeof this.channel != 'undefined' && this.channel.target !== this.p2pOptions.to) {
    this.onchannelclose = (function(e) {
      console.log('channel onclose:' + e)
      this.onchannelopen = (function() {
        if (this.p2pOptions.isCaller) {
          console.log('channel onopen')
          this.sendFileInternal(file, log)
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
        this.sendFileInternal(file, log)
      }
    }).bind(this)

    this.start()
  }
  else {
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
