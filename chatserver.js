var https = require('https')

module.exports.start = function(server) {
  var io = require('socket.io')(server)

  // users which are currently connected to the chat
  var users = {};
  var sockets = {};
  console.log('TalkYet server started')

  io.sockets.on('connection', function (socket) {
    var addedUser = false;
    var address = socket.handshake.address;

    socket.on('get ip', function() {
      socket.emit('return ip', address)
    })

    // when the client emits 'add user', this listens and executes
    socket.on('add user', function (data) {
      // we store the username in the socket session for this client
      if (data.username && data.roomname) {
        if (users[data.roomname] && users[data.roomname].indexOf(data.username) >= 0) {
          socket.emit('login error', {
            msg: 'user already exists in this room'
          })
          return;
        }

        if (data.username.indexOf('Guest_') === 0) {
          addUser(data)
        }
        else if (!!data.auth && data.auth.type === 'facebook') {
          console.log('verifying facebook')
          var options = {
            hostname: 'graph.facebook.com',
            port: 443,
            path: '/me?accesstoken=' + data.auth.accessToken,
            method: 'GET'
          }
          https.request(options, function(res) {
            console.log(res)
            if (res.verified && res.name === data.username) {
              console.log('server-side access token verification passed')
              addUser(data)
            }
            else {
              console.log('server-side access token verification failed')
              socket.emit('login error', {
                msg: 'login verification failed'
              })
            }
          }).end()
          .error(function() {
            console.log('failed to verify facebook access token')
            socket.emit('login error', {
              msg: 'failed to verify facebook login info'
            })
          })
        }
      }
      else {
        socket.emit('login error', {
          msg: 'empty username or roomname'
        })
      }
    });

    function addUser(data) {
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
        if (users[socket.roomname].indexOf(data.toUser) > -1 && typeof sockets[data.toUser] !== 'undefined') {
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
      if (!!data.to && !!data.from && typeof sockets[data.to] !== 'undefined') {
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
        if (typeof sockets[data.toUser] !== 'undefined') {
          sockets[data.toUser].emit('new info', {
            username: socket.username,
            message: data.msg,
            toUser: data.toUser
          })
        }
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
        if (users[socket.roomname].indexOf(data.toUser) > -1 && typeof sockets[data.toUser] !== 'undefined') {
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
