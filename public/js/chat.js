$(function() {
  var TYPING_TIMER_LENGTH = 2000; // ms
  var MIN_POKE_INTERVAL = 5000; // ms
  var COLORS = [
  '#e21400', '#91580f', '#f8a700', '#f78b00',
  '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
  '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
  var $roomnameInput = $('.roomnameInput'); // Input for username
  var $messages = $('#publicMessages'); // Messages area
  var $users = $('.users'); // User area
  var $inputMessage = $('.inputMessage'); // Input message input box
  var $privateMessage = $('.privateMessage')

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Context menu
  var $contextMenu = $("#contextMenu"); // Display and show the action menu
  var $privateModal = $('#privateChannel')
  var $videoModal = $('#videoChannel')

  var $videoNode = $('.remoteVideo').get(0)
  var $myVideoNode = $('.localVideo').get(0)
  var $audioNode = $('.remoteAudio').get(0)

  $('.mute').bootstrapSwitch('state')
  $('[data-toggle="tooltip"]').tooltip()

  if (!isChrome || chromeVersion < 28) {
    $('.rtcAction').css('opacity', 0.5)
  }

  i18n.init(/*{ lng: "zh" },*/ function(t) {

    $('.pages').i18n()

    // Variables
    var connected = false
    , typing = false
    , lastTypingTime
    , defaultTitle = t('TalkYet')
    , newMsgCancellationToken = { isCancelled: false }
    , username
    , roomname
    , guestname
    , authInfo
    , lastPoke = new Date('1970-01-01')
    , socket = io.connect(Common.getBaseUrl(), { secure: true })
    , filesToSend = {}  // Files to send out by receiver

    // Set up RTC connections
    if (!!configs) {
      initConfigs(null)
    }
    var dataChannel = new DataChannel(window.configs, window.constraints, socket)
    var mediaChannel = new MediaChannel(window.configs, window.constraints, socket)
    mediaChannel.videoNode = $videoNode
    mediaChannel.myVideoNode = $myVideoNode
    mediaChannel.audioNode = $audioNode

    dataChannel.onchannelopen = function() {
      console.log('channel onopen')
    }

    dataChannel.onchannelclose = function(e) {
      console.log('channel onclose:' + e)
    }
    dataChannel.onchannelerror = function(e) {
      console.error('channel error:' + e)
    }
    mediaChannel.onVideoStreamopen = function(evt) {
      $('.videos').show()
      $('.stopVideo').show()
      $('.stopVideo').i18n()
      $('.mediaControls').show()
      $('.callStatus').text('In Video Call')
      $('.callStatus').show()
      $videoModal.modal('show')
    }
    mediaChannel.onVideoStreamclose = function() {
      $('.videoIcon').hide()
      $('.videos').hide()
      $('.stopVideo').hide()
      $('.mediaControls').hide()
      $('.callStatus').hide()
      $videoModal.modal('hide')
    }
    mediaChannel.onAudioStreamopen = function(evt) {
      $('.audioIcon').show()
      $('.stopAudio').show()
      $('.mediaControls').show()
      $('.callStatus').text('In Audio Call')
      $('.callStatus').show()
    }
    mediaChannel.onAudioStreamclose = function() {
      $('.audioIcon').hide()
      $('.stopAudio').hide()
      $('.mediaControls').hide()
      $('.callStatus').hide()
    }

    $('#videoChannel').on('hidden.bs.modal', function() {
      if (mediaChannel.inSession) {
        $('.videoIcon').show()
      }
    })

    // Cookies
    var cUserName = Common.getCookie('username')
    var cRoomName = Common.getCookie('roomname')
    var cAuthInfo = null
    var cAuthInfoStr = Common.getCookie('authInfo')
    if (cAuthInfoStr.length > 0) {
      cAuthInfo = JSON.parse(cAuthInfoStr)
    }

    if (!!cRoomName && cRoomName !== '') {
      $roomnameInput.val(cRoomName)
    }

    if (cUserName.length > 0 && cRoomName.length > 0 && cUserName !== 'undefined' && !!cAuthInfo) {
      setUserName(cUserName, cRoomName, cAuthInfo)
    }
    else {
      $loginPage.show()
    }

    // Obtain client IP and set guestname
    getIP()


    // ---------- Functions -----------


    function addParticipantsMessage (data) {
      var message = '';
      if (data.numUsers === 1) {
        message += t("there's 1 participant");
      } else {
        message += t("there are ") + data.numUsers + t(" participants");
      }

      // Log the total number of current users
      log(message);
    }

    function getIP () {
      socket.emit('get ip')
    }

    socket.on('return ip', function(ip) {
      if (!username || username.length === 0) {
        guestname = "Guest_" + ip
      }
    })

    // Sets the client's username
    function setUserName (usernameIn, roomnameIn, authRes) {
      // If the username and roomname are valid
      if (!!roomnameIn && !!usernameIn) {
        roomname = roomnameIn;

        // Tell the server your username
        socket.emit('add user', {
          username: usernameIn,
          roomname: roomnameIn,
          auth: authRes || authInfo
        });

        if (!!authRes) {
          authInfo = authRes
        }
      }
      else {
        bootbox.alert(t('Error') + ':' + t('Invalid user name or room name'))
        $loginPage.show()
      }
    }

    function sendInfo (toUser, msg) {
      socket.emit('new info', {
        toUser: toUser,
        msg: msg
      })
    }

    function sendPoke(toUser) {
      var elapsed = Date.now() - lastPoke
      if (elapsed > MIN_POKE_INTERVAL) {
        log(t('You poked ') + toUser)
        socket.emit('new poke', {
          toUser: toUser
        })
        lastPoke = Date.now()
      }
      else {
        bootbox.alert(t('Sorry, you are poking too fast!'))
      }
    }

    // Sends a chat message
    function sendMessage (toUser) {
      var message
      if (toUser) {
        message = $privateMessage.val();
      }
      else {
        message = $inputMessage.val();
      }

      // Prevent markup from being injected into the message
      message = Common.cleanInput(message);

      // if there is a non-empty message and a socket connection
      if (message && connected) {
        if (toUser) {
          $privateMessage.val('');
          addChatMessage({
            username: username,
            message: message,
            toUser: toUser
          });

          // tell server to execute 'new message' and send along one parameter
          socket.emit('new message', { msg: message, toUser: toUser });
        }
        else {
          $inputMessage.val('');
          addChatMessage({
            username: username,
            message: message
          });

          // tell server to execute 'new message' and send along one parameter
          socket.emit('new message', { msg: message });
        }
      }
    }

    // Log a message
    function log (message, options) {
      options = options || {};
      var $el = $('<li>').addClass('log blinkOnAppearShort').text(message);
      if (typeof options.scrollToBottom == 'undefined') {
        options.scrollToBottom = true;
      }
      if (!!options.color) {
        $el = $el.css('color', options.color)
      }
      Common.addElement($el, $messages, $window, options);
    }

    function logFileComplete(filename, elapsedTime) {
      var msg = t('file') + ' "' + filename + '" ' + t('transfer completed in ') + elapsedTime + t('s')
      log(msg)
    }

    function logFileFailed() {
      log(t('already sending receiving a file'))
    }

    // Add the user to the current user list
    function addUser (theusername, list, options) {
      options = options || {};
      var $usernameDiv = $('<li class="username"/>')
      .text(theusername)
      .css('color', getUsernameColor(theusername));

      options.scrollToBottom = false;
      Common.addElement($usernameDiv, list, $window, options);
    }

    // Adds the visual chat message to the message list
    function addChatMessage (data, options) {
      options = options || {};

      // Don't fade the message in if there is an 'X was typing'
      var $typingMessages = getTypingMessages(data);
      if ($typingMessages.length !== 0) {
        options.fade = false;
        $typingMessages.remove();
      }

      var $messageTypeDiv = $('<span class="messageType"/>')

      var $dateTimeDiv = $('<span class="datetime"/>')
      .text(Common.getTime())

      var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));

      var $messageBodyDiv = $('<span class="messageBody bubble"/>')
      .html(Common.replaceNewLines(data.message));

      if (data.username === username) {
        $messageBodyDiv.addClass('me')
      }
      else {
        $messageBodyDiv.addClass('you')
      }

      var typingClass = data.typing ? 'typing' : '';
      var $messageDiv = $('<li class="message"/>')
        .data('username', data.username)
        .addClass(typingClass)

      if (!!data.toUser) {
        $messageBodyDiv.addClass('private')
        if (data.username === username)
        {
          //$messageTypeDiv.html('[to <b>' + data.toUser + '</b>] ')
        }
        else if (data.toUser === username)
        {
          //$messageTypeDiv.html('[<b>Private</b>] ')
        }
      }

      if (data.username === username) {
        $messageDiv
        .addClass('me')
        .append($usernameDiv, /*data.typing ? null : $dateTimeDiv,*/ $messageTypeDiv, $messageBodyDiv);
      }
      else {
        $messageDiv
        .addClass('you')
        .append($messageBodyDiv, $usernameDiv, /*data.typing ? null : $dateTimeDiv,*/ $messageTypeDiv);
      }

      // Add the new message and scroll to bottom
      options.scrollToBottom = true;
      Common.addElement($messageDiv, $messages, $window, options);

      if (data.username !== username && !data.typing) {
        newMsgCancellationToken.isCancelled = false;
        Common.newMsgTitle(t('New messages'), newMsgCancellationToken)
      }
    }

    function listRoommates(options) {
      options = options || {};
      options.scrollToBottom = true;

      var $messageDiv = $('<li class="message"/>')
      var $start = $('<span class="log"/>').text(t('Current people in the room') + ':');
      $messageDiv.html($start)

      var namelist = $('ul.users li').each(function() {
        var $usernameDiv = $('<span class="username"/>')
        .text($(this).text())
        .css('color', getUsernameColor($(this).text()));

        $messageDiv = $messageDiv.append($usernameDiv)
      })

      Common.addElement($messageDiv, $messages, $window, options)
    }

    // Adds the visual chat typing message
    function addChatTyping (data) {
      data.typing = true;
      data.message = t('is typing');
      addChatMessage(data);
    }

    // Removes the visual chat typing message
    function removeChatTyping (data) {
      getTypingMessages(data).fadeOut(function () {
        $(this).remove();
      });
    }

    // Updates the typing event
    function updateTyping () {
      if (connected) {
        if (!typing) {
          typing = true;
          socket.emit('typing');
        }
        lastTypingTime = (new Date()).getTime();

        setTimeout(function () {
          var typingTimer = (new Date()).getTime();
          var timeDiff = typingTimer - lastTypingTime;
          if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
            socket.emit('stop typing');
            typing = false;
          }
        }, TYPING_TIMER_LENGTH);
      }
    }

    // Gets the 'X is typing' messages of a user
    function getTypingMessages (data) {
      return $('.typing.message').filter(function (i) {
        return $(this).data('username') === data.username;
      });
    }

    // Gets the color of a username through our hash function
    function getUsernameColor (username) {
      // Compute hash code
      var hash = 7;
      for (var i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + (hash << 5) - hash;
      }
      // Calculate color
      var index = Math.abs(hash % COLORS.length);
      return COLORS[index];
    }

    // Keyboard events
    $('#enterRoomGuest').click(function (e) {
      username = null
      Common.deleteCookie('username')
      Common.deleteCookie('authInfo')
      setUserName(guestname, Common.cleanInput($roomnameInput.val().trim()));
    });

    $('#enterRoomFacebook').click(function (e) {
      FB.login(function(response) {
        if (response.status === 'connected') {
          // Logged into your app and Facebook.
          FB.api('/me', function(res) {
            console.log('Successful login for: ' + res.name);
            username = res.name
            var auth = response.authResponse
            auth.type = 'facebook'
            setUserName(Common.cleanInput(res.name), Common.cleanInput($roomnameInput.val().trim()), auth)
          });
        } else if (response.status === 'not_authorized') {
          // The person is logged into Facebook, but not your app.
          bootbox.alert(t('Error') + ':' + t('Failed to login'))
          username = null
          authInfo = null
        } else {
          // The person is not logged into Facebook, so we're not sure if
          // they are logged into this app or not.
          username = null
          authInfo = null
        }
      })
    })

    $('.roomnameInput').keydown(processsetUserName)

    function processsetUserName(e) {
      if (!username && e.which === 13)
      {
        setUserName(username, Common.cleanInput($roomnameInput.val().trim()));
      }
    }

    $window.keydown(function (e) {
      $contextMenu.hide();
    })

    $inputMessage.keydown(processInput)
    $privateMessage.keydown(processInput)

    function processInput(e) {
      if (username && e.which === 13) {
        if (!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) {
          if ($inputMessage.is(':focus')) {
            sendMessage();
            socket.emit('stop typing');
            typing = false;
          }
          else if ($privateMessage.is(':focus')) {
            sendMessage($privateModal.data('toUser'))
          }
        }
        else {
          e.preventDefault()
          e.stopPropagation()
          $(this).val(function(i, v) {
            return v + '\n'
          })
        }
      }
    }

    $inputMessage.on('input', function() {
      if ($inputMessage.val().length > 1) {
        updateTyping();
      }
    });

    // Click events

    // Focus input when clicking on the message input's border
    $inputMessage.click(function () {
      $inputMessage.focus();
    });

    // Focus input when clicking on the message input's border
    $privateMessage.click(function () {
      $privateMessage.focus();
    });

    // Socket events
    socket.on('disconnect', function() {
      window.location.reload()
    })

    // Whenever the server emits 'login', log the login message
    socket.on('login', function (data) {
      connected = true;
      $loginPage.fadeOut();
      $chatPage.show();
      $inputMessage.focus();

      // Detect browser type and version
      if (!isChrome || parseInt(window.navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10) < 29) {
        log(t('[Please use Chrome 29+ for video/audio chats and file transfer]'), { color: 'orange' })
      }

      // Display the welcome message
      var message = t("Welcome ") + data.username + t(" to Room ") + "\"" + data.roomname + "\"";
      log(message);
      addParticipantsMessage(data);

      // Add users to the user list for current user
      data.users.forEach(function(value, index, array) {
        addUser(value, $users)
      })

      // Set cookies for the last successful login
      if (!!username && username !== 'undefined' && username !== '') {
        Common.setCookie('username', username, 1)
      }
      if (!!roomname && roomname !== '') {
        Common.setCookie('roomname', roomname, 7)
      }
      if (!!authInfo) {
        Common.setCookie('authInfo', JSON.stringify(authInfo), 1)
      }
    });

    // Whenever the server emits 'new message', update the chat body
    socket.on('new message', function (data) {
      addChatMessage(data);
    });

    socket.on('new info', function (data) {
      log(data.message)
    })

    socket.on('new poke', function (data) {
      var from = data.username
      var to = data.toUser
      var msg = from + t(' has poked you!')
      log(msg)
      alert(msg)
    })

    // Whenever the server emits 'user joined', log it in the chat body
    socket.on('user joined', function (data) {
      log(data.username + t(' has joined'))
      addUser(data.username, $users)
    });

    // Whenever the server emits 'user left', log it in the chat body
    socket.on('user left', function (data) {
      log(data.username + t(' has left'))
      removeChatTyping(data);
      $('.users > li:contains("' + data.username + '")').remove()
    });

    // Whenever the server emits 'typing', show the typing message
    socket.on('typing', function (data) {
      addChatTyping(data);
    });

    // Whenever the server emits 'stop typing', kill the typing message
    socket.on('stop typing', function (data) {
      removeChatTyping(data);
    });

    socket.on('login error', function(e) {
      bootbox.alert(t('Error') + ':' + t(e.msg))
      $loginPage.show()
    })

    // Show and hide context menu
    $('ul.users').on('contextmenu', '.username', showContextMenu);
    $('ul.users').on('click', '.username', showContextMenu);
    $('ul.users').on('dragover', '.username', dragIgnoreDefault);
    $('ul.users').on('dragenter', '.username', dragIgnoreDefault);
    $('ul.users').on('drop', '.username', dragDrop);
    $('ul.messages').on('contextmenu', '.username', showContextMenu);
    $('ul.messages').on('click', '.username', showContextMenu);
    $('ul.messages').on('dragover', '.username', dragIgnoreDefault);
    $('ul.messages').on('drop', '.username', dragDrop);

    function dragIgnoreDefault(e) {
      e.preventDefault()
      e.stopPropagation()
    }

    function dragDrop(evt) {
      if (isChrome && chromeVersion >= 28) {
        var toUser = $(this).text()
        if(evt.originalEvent.dataTransfer){
          if (toUser !== username) {
            if(evt.originalEvent.dataTransfer.files.length) {
              evt.preventDefault();
              evt.stopPropagation();
              filesToSend[toUser] = evt.originalEvent.dataTransfer.files
              log(t('initiating file transfer with ') + toUser)
              socket.emit('start file request', {
                to: toUser
              })
            }
          }
        }
      }
      else {
        evt.preventDefault()
        evt.stopPropagation()
      }
    }

    function handleFileSelector(evt) {
      var toUser = $contextMenu.data('toUser')
      var files = evt.target.files
      filesToSend[toUser] = files
      log(t('initiating file transfer with ') + toUser)
      socket.emit('start file request', {
        to: toUser
      })
    }

    function handleFiles(files, user) {
      $(files).each(function(index, file) {
        var msg = t('Sending file "') + file.name + t('" to "') + user + t('". FileSize: ') + file.size;
        log(msg)
        dataChannel.p2pOptions.to = user
        dataChannel.p2pOptions.from = username
        sendInfo(user, username + ' =====>>> ' + user + ' : "' + file.name + '"')
        dataChannel.sendFile(file, logFileComplete, logFileFailed)
      })
    }

    function showContextMenu(e) {
      if ($(this).text() !== username) {
        $contextMenu.css({
          display: 'block',
          left: e.pageX,
          top: e.pageY
        });

        // Put the user into the data storage of the menu
        $contextMenu.data('toUser', $(this).text())
        $contextMenu.i18n()
      }

      return false;
    }

    $('#sendMsg').click(function(e) {
      var toUser = $contextMenu.data('toUser')
      $privateModal.data('toUser', toUser)
      $privateModal.find('.modal-title').text('To ' + toUser)
      $privateModal.modal('toggle')
    })

    $('#startVideo').click(function(e) {
      if (isChrome && chromeVersion >= 28) {
        var toUser = $contextMenu.data('toUser')
        log(t('initiating video connection with ') + toUser)
        socket.emit('start video request', {
          to: toUser
        })
      }
      else {
        e.preventDefault()
        e.stopPropagation()
      }
    })

    $('#startAudio').click(function(e) {
      if (isChrome && chromeVersion >= 28) {
        var toUser = $contextMenu.data('toUser')
        log(t('initiating audio connection with ') + toUser)
        socket.emit('start audio request', {
          to: toUser
        })
      }
      else {
        e.preventDefault()
        e.stopPropagation()
      }
    })

    $('#sendFile').click(function(e) {
      e.preventDefault()
      e.stopPropagation()
      if (isChrome && chromeVersion >= 28) {
        $('#fileInput').trigger('click')
      }
    })

    $('#fileInput').change(handleFileSelector)

    socket.on('start video response', function(data) {
      if (!!data && !!data.to) {
        var toUser = data.to
        if (data.permitted) {
          sendInfo(toUser, username + t('has initiated a video chat'))
          mediaChannel.startVideo(toUser, username)
        }
        else {
          log(t('failed to start video with ') + toUser + '. ' + data.message)
        }
      }
    })

    socket.on('start audio response', function(data) {
      if (!!data && !!data.to) {
        var toUser = data.to
        if (data.permitted) {
          sendInfo(toUser, username + t('has initiated an audio chat'))
          mediaChannel.startAudio(toUser, username)
        }
        else {
          log(t('failed to start audio with ') + toUser + '. ' + data.message)
        }
      }
    })

    socket.on('start file response', function(data) {
      if (!!data && !!data.to) {
        var toUser = data.to
        if (data.permitted) {
          var files = filesToSend[data.to]
          delete filesToSend[data.to]
          handleFiles(files, toUser);
        }
        else {
          log(t('failed to start file transfer with ') + toUser + '. ' + data.message)
        }
      }
    })

    $('#poke').click(function(e) {
      var toUser = $contextMenu.data('toUser')
      sendPoke(toUser)
    })

    $('#sendPrivateMsgBtn').click(function(e) {
      sendMessage($privateModal.data('toUser'))
    })

    $privateModal.on('shown.bs.modal', function () {
      $privateMessage.focus()
    })

    $('body').on('click', function() {
      $contextMenu.hide();
    })

    $('body').mouseover(function() {
      newMsgCancellationToken.isCancelled = true;
      $(document).prop('title', defaultTitle)
    })

    $('.navbarItem').click(function(e) {
      if ($('.navbar-toggle').is(':visible')) {
        $('.navbar-collapse').collapse('hide')
      }
    })

    $('#listroommates').click(function(e) {
      listRoommates()
    })

    $('#about').click(function(e) {
      bootbox.dialog({
        message: t('About Content'),
        title: t('About TalkYet'),
        onEscape: function() {},
        show: true,
        buttons: {
          success: {
            label: 'OK',
            className: 'btn-success',
            callback: function() {}
          }
        }
      })
    })

    $('#quit').click(function(e) {
      bootbox.confirm(t('Are you sure to quit?'), function(result) {
        if (true === result) {
          Common.deleteCookie('username')
          Common.deleteCookie('roomname')
          Common.deleteCookie('authInfo')
          window.location.reload(true)
        }
      })
    })

    // Stop the stream for p2p
    $('.stopVideo').click(function(e) {
      var toUser = mediaChannel.getPeer()
      if (!!toUser) {
        sendInfo(toUser, username + t('has stopped video chat'))
        mediaChannel.stopVideo()
        $('.mute').attr('checked', true)
      }
    })

    $('.stopAudio').click(function(e) {
      var toUser = mediaChannel.getPeer()
      if (!!toUser) {
        sendInfo(toUser, username + t('has stopped audio chat'))
        mediaChannel.stopAudio()
        $('.mute').attr('checked', true)
      }
    })

    $('.mute').on('switchChange.bootstrapSwitch', function(evt, state) {
      $('.mute').attr('checked', state)
      var toUser = mediaChannel.getPeer()
      if (!!toUser) {
        if (!state) {
          sendInfo(toUser, username + t('has muted their mic'))
        } else {
          sendInfo(toUser, username + t('has unmuted their mic'))
        }
        mediaChannel.muteMe(state)
      }
    })


    // Full screem mode
    $('.remoteVideo').dblclick(function(evt) {
      if (!document.fullscreenElement &&    // alternative standard method
        !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working m
          if ($videoNode.requestFullscreen) {
            $videoNode.requestFullscreen();
          } else if ($videoNode.mozRequestFullScreen) {
            $videoNode.mozRequestFullScreen(); // Firefox
          } else if ($videoNode.webkitRequestFullscreen) {
            $videoNode.webkitRequestFullscreen(); // Chrome and Safari
          }
        }
        else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      })

    }) // End of i18n.init

});
