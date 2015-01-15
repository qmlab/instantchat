var FADE_TIME = 250; // ms

// Adds a message element to the messages and scrolls to the bottom
// el - The element to add as a message
// list - the list to append/prepend to
// options.fade - If the element should fade-in (default = true)
// options.prepend - If the element should prepend
//   all other messages (default = false)
function AddElement (el, list, window, options) {
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
    window.scrollTop(list[0].scrollHeight);
  }
}

function GetTime() {
  var date = new Date()
  var month = new Array();
  month[0] = 'Jan';
  month[1] = 'Feb';
  month[2] = 'Mar';
  month[3] = 'Apr';
  month[4] = 'May';
  month[5] = 'Jun';
  month[6] = 'Jul';
  month[7] = 'Aug';
  month[8] = 'Sep';
  month[9] = 'Oct';
  month[10] = 'Nov';
  month[11] = 'Dec';
  return '[' + month[date.getMonth()] + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + '] '
}

function ReplaceNewLines (input) {
  var replacedString = input.replace(/\n/ig, '<br>')
  return replacedString
}

// Prevents input from having injected markup
function CleanInput (input) {
  var strippedString = input.replace(/(<([^>]+)>)/ig, '').replace(/^([\r\n]+)/ig, '');
  return strippedString;
}

function GetBaseUrl() {
  var getUrl = window.location
  return getUrl.protocol + '//' + getUrl.host + '/'
}


function ScrollTitle(text) {
  document.title = text;
  setTimeout(function () {
    ScrollTitle(text.substr(3) + text.substr(0, 3));
  }, 500);
}
