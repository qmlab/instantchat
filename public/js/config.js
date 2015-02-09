// Global configs

window.configs = {
  iceServers: []
}
window.contraints = {
  optional: []
}
window.moz = !!navigator.mozGetUserMedia;
window.IsDataChannelSupported = !((moz && !navigator.mozGetUserMedia) || (!moz && !navigator.webkitGetUserMedia));

function initConfigs(preferSCTP) {
  var isMobileDevice = navigator.userAgent.match(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile/i);
  var isChrome = !!navigator.webkitGetUserMedia;
  var isFirefox = !!navigator.mozGetUserMedia;
  var chromeVersion

  if (isFirefox) {
    /*
    configs.iceServers.push({
      url: 'stun:23.21.150.121'
    });
    */
    chromeVersion = 0
    configs.iceServers.push({
      url: 'stun:stun.services.mozilla.com'
    });
  }

  if (isChrome) {
    chromeVersion = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2]);
    configs.iceServers.push({
      url: 'stun:stun.l.google.com:19302'
    });

    /*
    configs.iceServers.push({
      url: 'stun:stun.anyfirewall.com:3478'
    });
    */
  }

  if (isChrome && chromeVersion < 28) {
    configs.iceServers.push({
      url: 'turn:homeo@turn.bistri.com:80?transport=udp',
      credential: 'homeo'
    });

    configs.iceServers.push({
      url: 'turn:homeo@turn.bistri.com:80?transport=tcp',
      credential: 'homeo'
    });
  }

  if (isChrome && chromeVersion >= 28) {
    configs.iceServers.push({
      url: 'turn:turn.bistri.com:80?transport=udp',
      credential: 'homeo',
      username: 'homeo'
    });

    configs.iceServers.push({
      url: 'turn:turn.bistri.com:80?transport=tcp',
      credential: 'homeo',
      username: 'homeo'
    });

    configs.iceServers.push({
      url: 'turn:turn.anyfirewall.com:443?transport=tcp',
      credential: 'webrtc',
      username: 'webrtc'
    });
  }

  if (!moz && !preferSCTP) {
    contraints.optional.push({
      RtpDataChannels: true
    })
  }

  if (!navigator.onLine) {
    config.iceServers = [];
    console.warn('No internet connection detected. No STUN/TURN server is used to make sure local/host candidates are used for peers connection.');
  }
}