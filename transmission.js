// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var io;
const cv = require('opencv4nodejs');
const {
    GLFWWindow
} = require('./glfw-window.js');
const win = new GLFWWindow(1280, 720, 'Node.js Capture Example');

const ipcRenderer = require('electron').ipcRenderer;
win.beginPaint();

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
        console.log('connected to localhost:3000');
        socket.on('clientEvent', function(data) {
            console.log("incoming")
            const outputMat = new cv.Mat(data.data, data.rows, data.cols, cv.CV_8UC3);
            cv.imshow("videoStream", outputMat);
            win.endPaint();
        });
    });
}

function createServerSesson() {
    console.log("clicked on Create Session")
    io = require('socket.io').listen(3000);
    io.on('connection', function(socket) {
        console.log('connected:', socket.client.id);
        socket.on('serverEvent', function(data) {
            console.log('new message from client:', data);
        });
        ipcRenderer.on('camera-data', function(event, data) {
            console.log("sending");
            socket.emit('clientEvent', data);
        });
    });
}