// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var io;
const cv = require('opencv4nodejs');


const ipcRenderer = require('electron').ipcRenderer;


document.getElementById('createSession').addEventListener("click", function() {
    createServerSesson();
});
document.getElementById('joinSession').addEventListener("click", function() {
    joinSession();
});

function joinSession() {
    io = require('socket.io-client');
    let hostIP = document.getElementById('joinSessionId').value;
    console.log(hostIP);
    let socket = io.connect(hostIP + ":3000/", {
        reconnection: true
    });

    socket.on('connect', function() {
        console.log('connected');
        socket.on('clientEvent', function(data) {
            const base64text= data.base64String;
            const base64data = base64text.replace('data:image/jpeg;base64','');
            const buffer = Buffer.from(base64data,'base64');
            const base64image = cv.imdecode(buffer);
            cv.imshow("videoStream", base64image);
            cv.waitKey(1)
        });
        ipcRenderer.on('camera-data', function(event, data) {
            console.log("sending");
            socket.emit('serverEvent', data);
        });
    });
}

function createServerSesson() {
    console.log("clicked on Create Session")
    io = require('socket.io').listen(3000);
    io.on('connection', function(socket) {
        console.log('connected:', socket.client.id);
        socket.on('serverEvent', function(data) {
			console.log("incoming");
            const base64text= data.base64String;
            const base64data = base64text.replace('data:image/jpeg;base64','')
                                        .replace('data:image/png;base64','');
            const buffer = Buffer.from(base64data,'base64');
            const base64image = cv.imdecode(buffer);
            cv.imshow("videoStream", base64image);
            cv.waitKey(1)
        });
        ipcRenderer.on('camera-data', function(event, data) {
            console.log("sending");
            socket.emit('clientEvent', data);
        });
    });
}
