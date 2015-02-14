// Setup basic express server
var express = require('express')
, app = express()
, server = require('http').createServer(app)
, chatserver = require('./chatserver.js')
, path = require('path')
, i18n = require('i18next')

var port = 3000

// For rendering views
app.set('views', __dirname + '/public')
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

// For static html
app.use(express.static(path.join(__dirname, 'public')));

//Register Handler
app.use(i18n.handle)

//Register AppHelper so you can use the translate function inside template
i18n.registerAppHelper(app)

//Init i18n
i18n.init(function(t) {
  server.listen(port, function () {
    console.log('Server listening at port %d', port);
  });

  // Routing
  app.get('/', function(req, res) {
    res.render('chat.ejs')
  })

  // Server
  chatserver.start(server)
})
