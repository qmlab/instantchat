// Setup basic express server
var express = require('express')
, app = express()
, chatserver = require('./chatserver.js')
, path = require('path')
, i18n = require('i18next')
, fs = require('fs')
, nconf = require('nconf')
, compress = require('compression')
, http = require('http')
, https = require('https')

// First consider commandline arguments and environment variables, respectively.
nconf.argv().env();

// Whether this is debug or release
var isDebug = false

if (nconf.get('debug')) {
  console.log('debug mode')
  isDebug = true
}

if (!isDebug) {
  // Provide configs for release
  nconf.file({ file: 'config.release.json' });
}
else {
  // Provide configs for release
  nconf.file({ file: 'config.debug.json' });
}

//var port = nconf.get('port')
var port = process.env.PORT || 3000;

// For rendering views
app.set('views', __dirname + '/public')
app.engine('html', require('jade').__express);
app.set('view engine', 'jade');

// For static html
app.use(express.static(path.join(__dirname, 'public')));

//Register Handler
app.use(i18n.handle)

//Register AppHelper so you can use the translate function inside template
i18n.registerAppHelper(app)

//Init i18n
i18n.init(function(t) {
  var server
  if (!isDebug) {
    app.get('*', function(req, res, next) {
      if (req.secure) {
        return next()
      }
      else {
        res.redirect('https://' + req.headers.host + req.url)
      }
    })

    // Routing, should be placed after redirect
    app.get('/', function(req, res) {
      res.render('chat.jade')
    })

    var privateKey  = fs.readFileSync('certs/talkyet.key', 'utf8')
    var certificate = fs.readFileSync('certs/talkyet.cer', 'utf8')
    var credentials = {key: privateKey, cert: certificate}
    server = https.createServer(credentials, app)
    server.listen(port, function () {
      console.log('Server listening at port %d', port)
    })

    var httpServer = http.createServer(app)
    httpServer.listen('80', function() {
      console.log('Http server listening at port 80')
    })
  }
  else {
    // Routing
    app.get('/', function(req, res) {
      res.render('chat.jade')
    })

    server = http.createServer(app)
    server.listen(port, function() {
      console.log('Debug: server listening at port %d', port)
    })
  }

  chatserver.start(server)
})
