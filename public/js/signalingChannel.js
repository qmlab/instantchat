function SignalingChannel(socket, that) {
  this.socket = socket
  this.socket.on('receive signal', that.onmessage.bind(that))
}

SignalingChannel.prototype.send = function(data) {
  this.socket.emit('send signal', data)
}
