// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var io;
const cv = require('opencv4nodejs');
var _socket;
var targetRole;
let screenHeight = 1080;
let screenWidth = 1920;
let displayStream = true;
let green = new cv.Vec3(89, 255, 0);
let black = new cv.Vec3(0,0,0);

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
document.getElementById('endStreaming').addEventListener("click", function() {
    displayStream = false;
    ipcRenderer.send('end-streaming');
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
            if(data.displayStream) {
                const base64text = data.base64String;
                const base64data = base64text.replace('data:image/jpeg;base64', '');
                const buffer = Buffer.from(base64data, 'base64');
                const base64image = cv.imdecode(buffer);
                if (data.mode && data.mode == "calibration") {
                    ipcRenderer.send('started-calibrating');
                    let counter = 20;
                    let timer = setInterval(function(){
                        counter--;
                        if(counter > -1) {
                            base64image.drawRectangle(
                                new cv.Point(screenWidth / 2 + 300, screenHeight / 2 + 300),
                                new cv.Point(screenWidth / 2 - 300, screenHeight / 2 - 300),
                                {color: new cv.Vec3(255, 255, 255), thickness: -1}
                            );
                            base64image.putText(
                                String(counter),
                                new cv.Point(screenWidth / 2, screenHeight / 2),
                                cv.FONT_ITALIC,
                                5, {
                                    color: black,
                                    thickness: 10
                                }
                            );
                        }
                        cv.imshow("videoStream", base64image);
                        cv.waitKey(1000);
                        if(counter == -3){
                            clearInterval(timer);
                            cv.destroyAllWindows();
                        }
                    },1000);
                }
                else {
                    cv.imshow("videoStream", base64image);
                    cv.waitKey(1)
                }
            }
            else{
                cv.destroyAllWindows();
            }
        });
        ipcRenderer.on('camera-data', function(event, data) {
                data.displayStream = displayStream;
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
            if(data.displayStream) {
                const base64text = data.base64String;
                const base64data = base64text.replace('data:image/jpeg;base64', '')
                    .replace('data:image/png;base64', '');
                const buffer = Buffer.from(base64data, 'base64');
                const base64image = cv.imdecode(buffer);
                if (data.mode && data.mode == "calibration") {
                    ipcRenderer.send('started-calibrating');
                    let counter = 20;
                    let timer = setInterval(function(){
                        counter--;
                        if(counter > -1){
                            base64image.drawRectangle(
                                new cv.Point(screenWidth / 2 + 300, screenHeight / 2 + 300),
                                new cv.Point(screenWidth / 2 - 300, screenHeight / 2 - 300),
                                {color: new cv.Vec3(255, 255, 255), thickness: -1}
                            );
                            base64image.putText(
                                String(counter),
                                new cv.Point(screenWidth / 2, screenHeight / 2),
                                cv.FONT_ITALIC,
                                5, {
                                    color: black,
                                    thickness: 10
                                }
                            );
                        }
                        cv.imshow("videoStream", base64image);
                        cv.waitKey(1000);
                        if(counter == -3){
                            clearInterval(timer);
                            cv.destroyAllWindows();
                        }
                    },1000);
                }
                else {
                    cv.imshow("videoStream", base64image);
                    cv.waitKey(1)
                }
            }
            else{
                cv.destroyAllWindows();
            }
        });
        ipcRenderer.on('camera-data', function(event, data) {
                data.displayStream = displayStream;
                socket.emit('clientEvent', data);
        });
    });
}

function calibrate() {
    //TODO: screen size not the same for every laptop; not a stream?
    if(_socket){
        const whiteMat = new cv.Mat(screenHeight,screenWidth, cv.CV_8UC3, [255, 255, 255]);//1080,1920 /////750,1300
        let buffer = 0;
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
        data.displayStream = true;
        _socket.emit(eventName, data);
    }
}




