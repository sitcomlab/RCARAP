// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var io;
const cv = require('opencv4nodejs');
var _socket;
var targetRole;
let screenHeight = 750;
let sceenWidth = 1300;


const ipcRenderer = require('electron').ipcRenderer;


document.getElementById('createSession').addEventListener("click", function() {
    createServerSesson();
});
document.getElementById('joinSession').addEventListener("click", function() {
    joinSession();
});

document.getElementById('calibrate').addEventListener("click", function() {
    calibrate();
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
        _socket = socket;
        targetRole = "server";
        socket.on('clientEvent', function(data) {
            const base64text= data.base64String;
            const base64data = base64text.replace('data:image/jpeg;base64','');
            const buffer = Buffer.from(base64data,'base64');
            const base64image = cv.imdecode(buffer);
            cv.imshow("videoStream", base64image);
            if(data.mode && data.mode == "calibration"){
                ipcRenderer.send('started-calibrating');
                cv.waitKey()
            }
            else{
                cv.waitKey(1)
            }
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
        _socket = socket;
        targetRole = "client";
        socket.on('serverEvent', function(data) {
            const base64text= data.base64String;
            const base64data = base64text.replace('data:image/jpeg;base64','')
                                        .replace('data:image/png;base64','');
            const buffer = Buffer.from(base64data,'base64');
            const base64image = cv.imdecode(buffer);
            cv.imshow("videoStream", base64image);
            if(data.mode && data.mode == "calibration"){
                ipcRenderer.send('started-calibrating');
                cv.waitKey()
            }
            else{
                cv.waitKey(1)
            }
        });
        ipcRenderer.on('camera-data', function(event, data) {
                console.log("sending");
                socket.emit('clientEvent', data);
        });
    });
}

function calibrate() {
    //TODO: screen size not the same for every laptop; not a stream?
    if(_socket){
        const whiteMat = new cv.Mat(screenHeight,screenWidth, cv.CV_8UC3, [255, 255, 255]);//1080,1920 /////750,1300
        let green = new cv.Vec3(89, 255, 0);
        let buffer = 20;
        whiteMat.drawRectangle(new cv.Point(0+buffer, 0+buffer),
            new cv.Point(140, 140),
            { color: green, thickness: -1 });
        whiteMat.drawRectangle(new cv.Point(whiteMat.cols-140, 0+buffer),
            new cv.Point(whiteMat.cols-buffer, 140),
            { color: green, thickness: -1 });
        whiteMat.drawRectangle(new cv.Point(0+buffer, whiteMat.rows-140),
            new cv.Point(140, whiteMat.rows-buffer),
            { color: green, thickness: -1 });
        whiteMat.drawRectangle(new cv.Point(whiteMat.cols-140, whiteMat.rows-140),
            new cv.Point(whiteMat.cols-buffer, whiteMat.rows-buffer),
            { color: green, thickness: -1 });
        //cv.imshow("test", whiteMat);
        //cv.waitKey();
        //detectSquares(whiteMat);
        const outBase64 =  cv.imencode('.jpg', whiteMat).toString('base64');
        let data = {base64String: outBase64, mode: "calibration"};
        let eventName = targetRole+"Event";
        console.log(eventName);
        _socket.emit(eventName, data);
    }
}




