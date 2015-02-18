// Module for common functions

var Common = (function() {
  var FADE_TIME = 250; // ms

  var extractSdp = function(sdpLine, pattern) {
    var result = sdpLine.match(pattern);
    return (result && result.length == 2)? result[1]: null;
  }


  var setDefaultCodec = function(mLine, payload) {
    var elements = mLine.split(' ');
    var newLine = new Array();
    var index = 0;
    for (var i = 0; i < elements.length; i++) {
      if (index === 3) newLine[index++] = payload;
      if (elements[i] !== payload) newLine[index++] = elements[i];
    }
    return newLine.join(' ');
  }

  var removeCN = function(sdpLines, mLineIndex) {
    var mLineElements = sdpLines[mLineIndex].split(' ');
    for (var i = sdpLines.length-1; i >= 0; i--) {
      var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
      if (payload) {
        var cnPos = mLineElements.indexOf(payload);
        if (cnPos !== -1) mLineElements.splice(cnPos, 1);
        sdpLines.splice(i, 1);
      }
    }
    sdpLines[mLineIndex] = mLineElements.join(' ');
    return sdpLines;
  }

  return {
    util: {},

    // Adds a message element to the messages and scrolls to the bottom
    // el - The element to add as a message
    // list - the list to append/prepend to
    // options.fade - If the element should fade-in (default = true)
    // options.prepend - If the element should prepend
    //   all other messages (default = false)
    addElement : function(el, list, window, options) {
      var $el = $(el)

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
    },

    getTime : function() {
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
    },

    replaceNewLines : function(input) {
      var replacedString = input.replace(/\n/ig, '<br>')
      return replacedString
    },

    // Prevents input from having injected markup
    cleanInput : function(input) {
      var strippedString = input.replace(/(<([^>]+)>)/ig, '').replace(/^([\r\n]+)/ig, '');
      return strippedString;
    },

    getBaseUrl : function() {
      var getUrl = window.location
      return getUrl.protocol + '//' + getUrl.host + '/'
    },


    // Update document title to the text
    // The cancellationToken is used to stop ongoing process
    newMsgTitle : function(text, cancellationToken) {
      if (!!cancellationToken && !cancellationToken.isCancelled) {
        document.title = text;
      }
      /*setTimeout((function () {
        if (!!cancellationToken && !cancellationToken.isCancelled)
        {
          this.scrollTitle(text.substr(3) + text.substr(0, 3));
        }
      }).bind(this), 500);
      */
    },

    logError : function(error) {
      console.log('error:' + error)
    },

    logSuccess : function(msg) {
      console.log('success:' + msg)
    },

    setOneWay : function(sdp) {
      var sdpLines = sdp.split('\r\n');

      for (var i = 0; i < sdpLines.length; i++) {
        sdpLines[i] = sdpLines[i].replace(/^a=sendrecv/i, 'a=sendonly')
      }

      sdp = sdpLines.join('\r\n');
      return sdp;
    },

    setTwoWay : function(sdp) {
      var sdpLines = sdp.split('\r\n');

      for (var i = 0; i < sdpLines.length; i++) {
        sdpLines[i] = sdpLines[i].replace(/^a=recvonly/i, 'a=sendrecv')
      }

      sdp = sdpLines.join('\r\n');
      return sdp;
    },

    preferOpus : function(sdp) {
      var sdpLines = sdp.split('\r\n');

      for (var i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('m=audio') !== -1) {
          var mLineIndex = i;
          break;
        }
      }

      if (typeof mLineIndex !== 'undefined') {
        for (i = 0; i < sdpLines.length; i++) {
          if (sdpLines[i].search('opus/48000') !== -1) {
            var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
            if (opusPayload) {
              sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
            }
            break;
          }
        }

        sdpLines = removeCN(sdpLines, mLineIndex);
      }

      sdp = sdpLines.join('\r\n');
      return sdp;
    },

    setSDPBandwidth : function(sdp, bandwidth) {
      var sdpLines = sdp.split('\r\n')

      for (var i = 0; i < sdpLines.length; i++) {
        sdpLines[i] = sdpLines[i].replace(/^b=AS:(\d)+/i, 'b=AS:' + bandwidth)
      }

      sdp = sdpLines.join('\r\n');
      return sdp;
    },

    saveToDisk : function(fileUrl, fileName) {
      var save = document.createElement('a');
      save.href = fileUrl;
      save.target = '_blank';
      save.download = fileName || fileUrl;

      var event = document.createEvent('Event');
      event.initEvent('click', true, true);

      save.dispatchEvent(event);
      (window.URL || window.webkitURL).revokeObjectURL(save.href);
    },

    appendBuffer : function( buffer1, buffer2 ) {
      var tmp = new Uint8Array( buffer1.byteLength + buffer2.byteLength );
      tmp.set( new Uint8Array( buffer1 ), 0 );
      tmp.set( new Uint8Array( buffer2 ), buffer1.byteLength );
      return tmp.buffer;
    },

    // from http://www.w3schools.com/js/js_cookies.asp
    getCookie : function(cname) {
        var name = cname + "=";
        var ca = document.cookie.split(';');
        for(var i=0; i<ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1);
            if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
        }
        return "";
    },

    // from http://www.w3schools.com/js/js_cookies.asp
    setCookie : function(cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays*24*60*60*1000));
        var expires = "expires="+d.toUTCString();
        document.cookie = cname + "=" + cvalue + "; " + expires;
    },

    deleteCookie : function(cname) {
      document.cookie = cname + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC'
    },

    isGuest : function(name) {
      return (!!name && name.indexOf('Guest_') === 0)
    }
  }
})()
