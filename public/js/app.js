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
  var $currentInput = $usernameInput.focus();

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Context menu
  var $contextMenu = $("#contextMenu"); // Display and show the action menu
  var $privateModal = $('#privateChannel')

  // Apprise
  // Add overlay and set opacity for cross-browser compatibility
  $body = $('body');
  $window = $(window);

  // Prompt for setting a username
  var username
  , roomname
  , connected = false
  , typing = false
  , lastTypingTime
  , defaultTitle = 'QMChat'

  var socket = io.connect('http://localhost:3000');

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
    username = CleanInput($usernameInput.val().trim());
    roomname = CleanInput($roomnameInput.val().trim());

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
    message = CleanInput(message);

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
    AddElement($el, $messages, $window, options);
  }

  // Add the user to the current user list
  function addUser (data, options) {
    options = options || {};
    var $usernameDiv = $('<li class="username"/>')
    .text(data.username)
    .css('color', getUsernameColor(data.username));

    options.scrollToBottom = false;
    AddElement($usernameDiv, $users, $window, options);
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
    .text(GetTime())

    var $usernameDiv = $('<span class="username"/>')
    .text(data.username)
    .css('color', getUsernameColor(data.username));

    var $messageBodyDiv = $('<span class="messageBody"/>')
    .text(ReplaceNewLines(data.message));

    if (data.toUser) {
      if (data.username === username)
      {
        $messageTypeDiv.text('[to ' + data.toUser + '] ')
      }
      else if (data.toUser === username)
      {
        $messageTypeDiv.text('[from ' + data.username + '] ')
      }
    }

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
    .data('username', data.username)
    .addClass(typingClass)
    .append($usernameDiv, $dateTimeDiv, $messageTypeDiv, $messageBodyDiv);

    // Add the new message and scroll to bottom
    options.scrollToBottom = true;
    AddElement($messageDiv, $messages, $window, options);

    if (data.username !== username && !data.typing) {
      $(document).prop('title', 'New Message~~')
    }
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
  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $(document).prop('title', defaultTitle)
      //$currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        if (event.ctrlKey) {
          if ($inputMessage.is(':focus')) {
            sendMessage();
            socket.emit('stop typing');
            typing = false;
          }
          else if ($privateMessage.is(':focus')) {
            sendMessage($privateModal.data('toUser'))
          }
        }
      } else {
        setUsername();
      }
    }
    $contextMenu.hide();
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  $('#enterRoom').click(function (event) {
    setUsername();
  })

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    //$currentInput.focus();
  });

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
    $currentInput = $inputMessage.focus();

    // Display the welcome message
    var message = "Room [" + data.roomname + "]";
    log(message, {
      prepend: true
    });
    var message = "Welcome " + data.username + "!";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);

    // Add users to the user list for current user
    data.users.forEach(function(value, index, array) {
      addUser({ username: value })
    })
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' has joined');
    addUser(data)
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
  $('ul.users').on('contextmenu', 'li', function(e) {
    $contextMenu.css({
      display: 'block',
      left: e.pageX,
      top: e.pageY
    });

    // Put the user into the data storage of the menu
    $contextMenu.data('toUser', $(this).text())

    return false;
  });

  $('#sendMsg').click(function(e) {
    var toUser = $contextMenu.data('toUser')
    $privateModal.data('toUser', toUser)
    $privateModal.find('.modal-title').text('To ' + toUser)
    $privateModal.modal('toggle')
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
    $(document).prop('title', defaultTitle)
  })
});
