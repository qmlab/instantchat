$(function() {
  var TYPING_TIMER_LENGTH = 2000; // ms
  var COLORS = [
  '#e21400', '#91580f', '#f8a700', '#f78b00',
  '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
  '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
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

  videoNode = $('.remoteVideo').get(0)
  myVideoNode = $('.localVideo').get(0)
  audioNode = $('.remoteAudio').get(0)
  window.AudioContext = window.AudioContext || window.webkitAudioContext

  $("#muteSwitch").bootstrapSwitch('state')
  $("#holdSwitch").bootstrapSwitch('state')

  // Variables
  var connected = false
  , typing = false
  , lastTypingTime
  , defaultTitle = 'InstantChat'
  , newMsgCancellationToken = { isCancelled: false }
  , username
  , roomname

  var socket = io.connect(getBaseUrl());

  // Set up RTC connection
  signalingChannel = new SignalingChannel(socket)

  onchannelopen = function() {
    console.log('channel onopen')
  }

  var chunks = [];
  var blobs = [];
  onchannelmessage = function (event) {
    var data = JSON.parse(event.data);
    var blobCount = 0;
    chunks.push(data.message); // pushing chunks in array
    if (chunks.length > CHUNKBUFFERSIZE || data.last) {
      blobs.push(new Blob([chunks], {type: mime}))
      chunks = []
      console.log('created blob ' + blobCount)
      blobCount++
    }

    if (data.last) {
      var finalBlob = new Blob(blobs, {type: mime})
      console.log('final blob created')
      saveToDisk(URL.createObjectURL(finalBlob), data.filename);
      blobs = []
    }
  }

  onchannelclose = function(e) {
    console.log('channel onclose:' + e)
  }
  onchannelerror = function(e) {
    console.error('channel error:' + e)
  }
  onVideoStreamopen = function(evt) {
    $('.videoIcon').show()
    $('.videos').show()
    $('.stopVideo').show()
    $('.callStatus').text('In Video Call')
    $('.callStatus').show()
    $videoModal.modal('show')
  }
  onVideoStreamclose = function() {
    $('.videoIcon').hide()
    $('.videos').hide()
    $('.stopVideo').hide()
    $('.callStatus').hide()
    $videoModal.modal('hide')
  }
  onAudioStreamopen = function(evt) {
    $('.audioIcon').show()
    $('.stopAudio').show()
    $('.audioControls').show()
    $('.callStatus').text('In Audio Call')
    $('.callStatus').show()
  }
  onAudioStreamclose = function() {
    $('.audioIcon').hide()
    $('.stopAudio').hide()
    $('.audioControls').hide()
    $('.callStatus').hide()
  }


  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }

    // Log the total number of current users
    log(message);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());
    roomname = cleanInput($roomnameInput.val().trim());

    // If the username is valid
    if (username && roomname) {
      //$loginPage.off('click');

      // Tell the server your username
      socket.emit('add user', {
        username: username,
        roomname: roomname
      });
    }
    else {
      bootbox.alert('Error: Invalid user name or room name')
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
    message = cleanInput(message);

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
    var $el = $('<li>').addClass('log').text(message);
    if (typeof options.scrollToBottom == 'undefined') {
      options.scrollToBottom = true;
    }
    addElement($el, $messages, $window, options);
  }

  // Add the user to the current user list
  function addUser (theusername, list, options) {
    options = options || {};
    var $usernameDiv = $('<li class="username"/>')
    .text(theusername)
    .css('color', getUsernameColor(theusername));

    options.scrollToBottom = false;
    addElement($usernameDiv, list, $window, options);
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
    .text(getTime())

    var $usernameDiv = $('<span class="username"/>')
    .text(data.username)
    .css('color', getUsernameColor(data.username));

    var $messageBodyDiv = $('<span class="messageBody"/>')
    .html(replaceNewLines(data.message));

    if (data.toUser) {
      if (data.username === username)
      {
        $messageTypeDiv.html('[to <b>' + data.toUser + '</b>] ')
      }
      else if (data.toUser === username)
      {
        $messageTypeDiv.html('[from <b>' + data.username + '</b>] ')
      }
    }

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
    .data('username', data.username)
    .addClass(typingClass)
    .append($usernameDiv, $dateTimeDiv, $messageTypeDiv, $messageBodyDiv);

    // Add the new message and scroll to bottom
    options.scrollToBottom = true;
    addElement($messageDiv, $messages, $window, options);

    if (data.username !== username && !data.typing) {
      newMsgCancellationToken.isCancelled = false;
      scrollTitle("You have new messages ", newMsgCancellationToken)
    }
  }

  function listRoommates(options) {
    options = options || {};
    options.scrollToBottom = true;

    var $messageDiv = $('<li class="message"/>')
    var $start = $('<span class="log"/>').text('Current people in the room:');
    $messageDiv.html($start)

    var namelist = $('ul.users li').each(function() {
      var $usernameDiv = $('<span class="username"/>')
      .text($(this).text())
      .css('color', getUsernameColor($(this).text()));

      $messageDiv = $messageDiv.append($usernameDiv)
    })

    addElement($messageDiv, $messages, $window, options)
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
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
  $('#enterRoom').click(function (e) {
    setUsername();
  });

  $('.usernameInput').keydown(processSetUserName)
  $('.roomnameInput').keydown(processSetUserName)

  function processSetUserName(e) {
    if (!username && e.which === 13)
    {
      setUsername()
    }
  }

  $window.keydown(function (e) {
    $contextMenu.hide();
  })

  $inputMessage.keydown(processInput)
  $privateMessage.keydown(processInput)

  function processInput(e) {
    if (username && e.which === 13) {
      if (!(e.ctrlKey || e.metaKey || e.altKey)) {
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

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    $loginPage.fadeOut();
    $chatPage.show();
    $inputMessage.focus();

    // Display the welcome message
    var message = "Welcome " + data.username + " to " + "Room \"" + data.roomname + "\"";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);

    // Add users to the user list for current user
    data.users.forEach(function(value, index, array) {
      addUser(value, $users)
    })
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' has joined');
    addUser(data.username, $users)
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' has left');
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

  socket.on('error message', function(e) {
    bootbox.alert('Error: ' + e.msg)
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

  function dragDrop(e) {
    if(e.originalEvent.dataTransfer){
      if ($(this).text() !== username) {
        if(e.originalEvent.dataTransfer.files.length) {
          e.preventDefault();
          e.stopPropagation();
          handleFiles(e.originalEvent.dataTransfer.files, $(this).text());
        }
      }
    }
  }

  var startTimes = {}
  function handleFiles(files, user) {
    $(files).each(function(index, file) {
      var msg = 'Sending file "' + file.name + '" to "' + user + '". FileSize: ' + file.size;
      log(msg)
      var reader = new FileReader();
      reader.onload = function(e) {
        p2pOptions.to = user
        p2pOptions.from = username
        p2pOptions.isCaller = true
        startTimes[file.name] = new Date()
        dataChannelSend(e, file.name, onReadAsDataURL)
      }
      reader.readAsDataURL(file)
    })
  }

  function dataChannelSend(evt, filename, callback) {
    if (!!channel && channel.target !== p2pOptions.to) {
      onchannelclose = function(e) {
        console.log('channel onclose:' + e)
        onchannelopen = function() {
          if (p2pOptions.isCaller) {
            console.log('channel onopen')
            callback(evt, null, filename)
          }
        }
        start()
        onchannelclose = function(e) {
          console.log('channel onclose:' + e)
        }
      }

      stopSession()
    }
    else if (!channel) {
      onchannelopen = function() {
        if (p2pOptions.isCaller) {
          console.log('channel onopen')
          callback(evt, null, filename)
        }
      }
      start()
    }
    else {
      callback(evt, null, filename)
    }
  }

  var numOfFunctionCalls = 0; // Prevent stack from being too deep
  function onReadAsDataURL(event, text, filename) {
    numOfFunctionCalls++;
    var data = {}; // data object to transmit over data channel

    if (event) text = event.target.result; // on first invocation

    data.filename = filename
    if (text.length > CHUNKSIZE) {
      data.message = text.slice(0, CHUNKSIZE); // getting chunk using predefined chunk length
    } else {
      data.message = text;
      data.last = true;
    }

    sendData(JSON.stringify(data), function() {
      var remainingDataURL = text.slice(data.message.length);
      if (remainingDataURL.length) {
        if (numOfFunctionCalls % 100 === 0) {
          setTimeout(function() { onReadAsDataURL(null, remainingDataURL, data.filename); }, 10)
        }
        else {
          onReadAsDataURL(null, remainingDataURL, data.filename);
        }
      }
      else {
        stopSession(true)
        var endTime = new Date()
        var elapsedTime = (endTime - startTimes[filename]) / 1000
        var msg = 'file "' + filename + '" transfer completed in ' + elapsedTime + 's.'
        log(msg)
      }
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
    var toUser = $contextMenu.data('toUser')
    p2pOptions.audio = true
    p2pOptions.video = true
    p2pOptions.to = toUser
    p2pOptions.from = username
    p2pOptions.isCaller = true
    p2pOptions.isMedia = true
    onVideoStreamopen()
    start()
  })

  $('#startAudio').click(function(e) {
    var toUser = $contextMenu.data('toUser')
    p2pOptions.audio = true
    p2pOptions.video = false
    p2pOptions.to = toUser
    p2pOptions.from = username
    p2pOptions.isCaller = true
    p2pOptions.isMedia = true
    onAudioStreamopen()
    start()
  })

  $('#testP2p').click(function(e) {
    var toUser = $contextMenu.data('toUser')
    p2pOptions.to = toUser
    p2pOptions.from = username
    p2pOptions.isCaller = true
    onchannelopen = function() {
      if (p2pOptions.isCaller)
      {
        $('#testData').show()
      }
      console.log('channel onopen')
    }
    start()
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
      message: '<b>InstantChat <i>Version 1.0</i></b><br><br> by QM<br> @ 2015',
      title: 'About InstantChat',
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
    bootbox.confirm('Are you sure to quit?', function(result) {
      if (true === result) {
        window.location.reload(true)
      }
    })
  })

  // Stop the stream for p2p
  $('.stopVideo').click(function(e) {
    if(!!localStream) {
      myVideoNode.pause()
    }
    if(!!remoteStream) {
      videoNode.pause()
    }
    stopSession()
    onVideoStreamclose()
  })

  $('.stopAudio').click(function(e) {
    audioNode.pause()
    stopSession()
    onAudioStreamclose()
  })

  $('.mute').on('switchChange.bootstrapSwitch', function(evt, state) {
    localStream.getAudioTracks()[0].enabled = state
  })

  /*
  $('.hold').on('switchChange.bootstrapSwitch', function(evt, state) {
    if (state) {
      if (p2pOptions.video) {
        if(!!localStream) {
          myVideoNode.play()
        }
        if(!!remoteStream) {
          videoNode.play()
        }
      }
      else if (p2pOptions.audio) {
        if(!!localStream || !!remoteStream) {
          audioNode.play()
        }
      }
    }
    else {
      if (p2pOptions.video) {
        if(!!localStream) {
          myVideoNode.pause()
        }
        if(!!remoteStream) {
          videoNode.pause()
        }
      }
      else if (p2pOptions.audio) {
        if(!!localStream || !!remoteStream) {
          audioNode.play()
        }
      }
    }
  })
  */

  $('#testData').click(function(e) {
    sendData('Testing!', function() {
      stopSession()
      $('#testData').hide()
    })
  })
});
