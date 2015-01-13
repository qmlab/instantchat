$(function() {
  var FADE_TIME = 250; // ms
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
  var $messages = $('.messages'); // Messages area
  var $users = $('.users'); // User area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Context menu
  var $contextMenu = $("#contextMenu"); // Display and show the action menu

  // Apprise
  // Add overlay and set opacity for cross-browser compatibility
  $Apprise = $('<div class="apprise">');
  $overlay = $('<div class="apprise-overlay">');
  $body = $('body');
  $window = $(window);
  $body.append( $overlay.css('opacity', '.94') ).append($Apprise);

  // Prompt for setting a username
  var username;
  var roomname;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

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
      Apprise('Error: Invalid user name or room name')
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });

      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  function log (message, options) {
    options = options || {};
    var $el = $('<li>').addClass('log').text(message);
    if (typeof options.scrollToBottom == 'undefined') {
      options.scrollToBottom = true;
    }
    addElement($el, $messages, options);
  }

  // Add the user to the current user list
  function addUser (data, options) {
    options = options || {};
    var $usernameDiv = $('<li class="username"/>')
    .text(data.username)
    .css('color', getUsernameColor(data.username));

    options.scrollToBottom = false;
    addElement($usernameDiv, $users, options);
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

    var $dateTimeDiv = $('<span class="datetime"/>')
    .text(GetTime())

    var $usernameDiv = $('<span class="username"/>')
    .text(data.username)
    .css('color', getUsernameColor(data.username));

    var $messageBodyDiv = $('<span class="messageBody">')
    .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
    .data('username', data.username)
    .addClass(typingClass)
    .append($usernameDiv, $dateTimeDiv, $messageBodyDiv);

    options.scrollToBottom = true;
    addElement($messageDiv, $messages, options);
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

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // list - the list to append/prepend to
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addElement (el, list, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      list.prepend($el);
    } else {
      list.append($el);
    }

    if (options.scrollToBottom === true) {
      $window.scrollTop(list[0].scrollHeight);
    }
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
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
      //$currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
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
    Apprise('Error: ' + e.msg)
  })


  // Show and hide context menu
  $('ul.users').on('contextmenu', 'li', function(e) {
    $contextMenu.css({
      display: 'block',
      left: e.pageX,
      top: e.pageY
    });
    //alert( $( this ).text() );
    return false;
  });

  $('body').on('click', function() {
    $contextMenu.hide();
  })
});

function GetTime() {
  var date = new Date()
  var month = new Array();
  month[0] = "Jan";
  month[1] = "Feb";
  month[2] = "Mar";
  month[3] = "Apr";
  month[4] = "May";
  month[5] = "Jun";
  month[6] = "Jul";
  month[7] = "Aug";
  month[8] = "Sep";
  month[9] = "Oct";
  month[10] = "Nov";
  month[11] = "Dec";
  return '[' + month[date.getMonth()] + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + '] '
}
