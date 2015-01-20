// Setup basic express server
var express = require('express')
, app = express()
, server = require('http').createServer(app)
, chatserver = require('./chatserver.js')
, path = require('path')

var port = 3000

// For rendering views
app.set('views', __dirname + '/public')
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

// For static html
app.use(express.static(path.join(__dirname, 'public')));

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.get('/chat', function(req, res) {
  res.render('chat.ejs')
})

app.get('/test', function(req, res) {
  res.render('testp2p.ejs')
})

// Server
chatserver.start(server)
