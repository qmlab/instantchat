module.exports.start = function(server) {
  var io = require('socket.io')(server)

  // users which are currently connected to the chat
  var users = {};
  var sockets = {};
  console.log('instantchat server started')

  io.sockets.on('connection', function (socket) {
    var addedUser = false;

    // when the client emits 'add user', this listens and executes
    socket.on('add user', function (data) {
      // we store the username in the socket session for this client
      if (data.username && data.roomname) {
        if (users[data.roomname] && users[data.roomname].indexOf(data.username) >= 0) {
          socket.emit('error message', {
            msg: 'user already exists in this room'
          })
          return;
        }

        // Store the socket
        sockets[data.username] = socket;

        socket.join(data.roomname);
        socket.username = data.username;
        socket.roomname = data.roomname;
        console.log(socket.username + ' joined ' + socket.roomname);

        users[socket.roomname] = users[socket.roomname] || []

        // add the client's username to the global list
        users[socket.roomname].push(socket.username);
        addedUser = true;
        socket.emit('login', {
          numUsers: users[socket.roomname].length,
          users: users[socket.roomname],
          username: socket.username,
          roomname: socket.roomname
        })

        // echo globally (all clients) that a person has connected
        socket.broadcast.to(socket.roomname).emit('user joined', {
          username: socket.username,
          numUsers:users[socket.roomname].length
        });
      }
      else {
        socket.emit('error message', {
          msg: 'empty username or roomname'
        })
      }
    });

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {
      if (typeof data.toUser == 'undefined') {
        // we tell the client to execute 'new message'
        socket.broadcast.to(socket.roomname).emit('new message', {
          username: socket.username,
          message: data.msg
        });
      }
      else {
        if (users[socket.roomname].indexOf(data.toUser) > -1) {
          sockets[data.toUser].emit('new message', {
            username: socket.username,
            message: data.msg,
            toUser: data.toUser
          })
        }
        else {
          socket.emit('new info', {
            message: 'Action failed. User does not exist.'
          })
        }
      }
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {
      socket.broadcast.to(socket.roomname).emit('typing', {
        username: socket.username
      });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', function () {
      socket.broadcast.to(socket.roomname).emit('stop typing', {
        username: socket.username
      });
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function () {
      // remove the username from global users list
      if (addedUser) {
        users[socket.roomname].remove(socket.username);
        socket.leave(socket.roomname)
        console.log(socket.username + ' left ' + socket.roomname);

        // echo globally that this client has left
        socket.broadcast.to(socket.roomname).emit('user left', {
          username: socket.username,
          numUsers: users[socket.roomname].length
        });

        delete socket.roomname
        delete sockets[socket.username]
        delete socket.username
      }
    });

    socket.on('send signal', function(data) {
      //console.log('from:' + data.from + ' to:' + data.to)
      //console.log(JSON.stringify(data))
      if (!!data.to && !!data.from) {
        sockets[data.to].emit('receive signal ' + data.type || 'general', data)
      }
    })

    // Non-message info
    socket.on('new info', function (data) {
      if (typeof data.toUser == 'undefined') {
        // we tell the client to execute 'new message'
        socket.broadcast.to(socket.roomname).emit('new info', {
          username: socket.username,
          message: data.msg
        });
      }
      else {
        sockets[data.toUser].emit('new info', {
          username: socket.username,
          message: data.msg,
          toUser: data.toUser
        })
      }
    });


    // Non-message poke
    socket.on('new poke', function (data) {
      if (typeof data.toUser == 'undefined') {
        // we tell the client to execute 'new message'
        socket.broadcast.to(socket.roomname).emit('new poke', {
          username: socket.username
        });
      }
      else {
        if (users[socket.roomname].indexOf(data.toUser) > -1) {
          sockets[data.toUser].emit('new poke', {
            username: socket.username,
            toUser: data.toUser
          })
        }
        else {
          socket.emit('new info', {
            message: 'Action failed. User does not exist.'
          })
        }
      }
    });

    socket.on('start audio request', function(data) {
      if (users[socket.roomname].indexOf(data.to) > -1) {
        socket.emit('start audio response', {
          permitted: true,
          to: data.to
        })
      }
      else {
        socket.emit('start audio response', {
          message: 'User does not exist.',
          to: data.to
        })
      }
    })

    socket.on('start video request', function(data) {
      if (users[socket.roomname].indexOf(data.to) > -1) {
        socket.emit('start video response', {
          permitted: true,
          to: data.to
        })
      }
      else {
        socket.emit('start video response', {
          message: 'User does not exist.',
          to: data.to
        })
      }
    })

    socket.on('start file request', function(data) {
      if (users[socket.roomname].indexOf(data.to) > -1) {
        socket.emit('start file response', {
          permitted: true,
          to: data.to
        })
      }
      else {
        socket.emit('start file response', {
          message: 'User does not exist.',
          to: data.to
        })
      }
    })

  })


  Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
      what = a[--L];
      while ((ax = this.indexOf(what)) !== -1) {
        this.splice(ax, 1);
      }
    }
    return this;
  };

}
