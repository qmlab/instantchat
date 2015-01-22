$(function() {
  var TYPING_TIMER_LENGTH = 2000; // ms
  var COLORS = [
  '#e21400', '#91580f', '#f8a700', '#f78b00',
  '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
  '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
/*
  var socket = io.connect(GetBaseUrl());
  signalingChannel = new SignalingChannel(socket)
  setupReceiver()
  */

  var createSrc = window.URL ? window.URL.createObjectURL : function(stream) {return stream;};
  var video = $('#videoTest').get(0)
  // For test
    //start()
    navigator.getUserMedia({ "audio": true, "video": true}, function (stream) {
      video.src = createSrc(stream)
      video.play()
    }, logError)
});


function logError(error) {
  log(error.name + ": " + error.message);
}
