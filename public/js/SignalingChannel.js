function SignalingChannel(socket) {
  this.socket = socket
  this.onmessage = function(data){}
  this.socket.on('receive signal', this.onmessage)
}

SignalingChannel.prototype.send = function(data) {
  this.socket.emit('send signal', data)
}
