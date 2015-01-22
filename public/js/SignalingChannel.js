function SignalingChannel(socket) {
  this.socket = socket
  this.onmessage = function(data){alert('signal received')}
  this.socket.on('receive signal', this.onmessage)
}

SignalingChannel.prototype.send = function(data) {
  this.socket.emit('send signal', data)
}
