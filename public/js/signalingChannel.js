// Class for signaling channel client

function SignalingChannel(socket, type, that) {
  this.socket = socket
  this.socket.on('receive signal ' + type || 'general', that.onmessage.bind(that))
}

SignalingChannel.prototype.send = function(data) {
  this.socket.emit('send signal', data)
}
