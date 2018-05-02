var express = require('express')
var app = express()
var path = require('path');

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});
// … Configure Express, and register necessary route handlers
srv = app.listen(8080, function () {
    console.log("Listening on port 8080")
});

app.use(express.static('public'));
app.use('/peerjs', require('peer').ExpressPeerServer(srv, {
    debug: true
}))
