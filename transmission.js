// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var io;
const cv = require('opencv4nodejs');
var startedStreaming = false;
var _socket;
var targetRole;


const ipcRenderer = require('electron').ipcRenderer;


document.getElementById('createSession').addEventListener("click", function() {
    createServerSesson();
});
document.getElementById('joinSession').addEventListener("click", function() {
    joinSession();
});

document.getElementById('startStreaming').addEventListener("click", function() {
    startedStreaming = true;
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
                cv.waitKey()
            }
            else{
                cv.waitKey(1)
            }
        });
        ipcRenderer.on('camera-data', function(event, data) {
            console.log(startedStreaming);
            if(startedStreaming) {
                console.log("sending");
                socket.emit('serverEvent', data);
            }
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
                cv.waitKey()
            }
            else{
                cv.waitKey(1)
            }
        });
        ipcRenderer.on('camera-data', function(event, data) {
            console.log(startedStreaming);
            if(startedStreaming) {
                console.log("sending");
                socket.emit('clientEvent', data);
            }
        });
    });
}

function calibrate() {
    //TODO: screen size not the same for every laptop; not a stream?
    if(_socket){
        const whiteMat = new cv.Mat(1050, 1920, cv.CV_8UC3, [255, 255, 255]);
        let green = new cv.Vec3(0, 255, 0);
        let buffer = 20;
        whiteMat.drawRectangle(new cv.Point(0+buffer, 0+buffer),
            new cv.Point(70, 70),
            { color: green, thickness: 2 });
        whiteMat.drawRectangle(new cv.Point(whiteMat.cols-70, 0+buffer),
            new cv.Point(whiteMat.cols-buffer, 70),
            { color: green, thickness: 2 });
        whiteMat.drawRectangle(new cv.Point(0+buffer, whiteMat.rows-70),
            new cv.Point(70, whiteMat.rows-buffer),
            { color: green, thickness: 2 });
        whiteMat.drawRectangle(new cv.Point(whiteMat.cols-70, whiteMat.rows-70),
            new cv.Point(whiteMat.cols-buffer, whiteMat.rows-buffer),
            { color: green, thickness: 2 });
        //cv.imshow("test", whiteMat);
        //cv.waitKey();
        detectSquares(whiteMat);
        const outBase64 =  cv.imencode('.jpg', whiteMat).toString('base64');
        let data = {base64String: outBase64, mode: "calibration"};
        let eventName = targetRole+"Event";
        console.log(eventName);
        _socket.emit(eventName, data);
    }
}


function detectSquares(mat) {
    let gray = mat.bgrToGray();
    let canny = gray.canny(200,255,3,false);

    const dilated = canny.dilate(
        cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(4, 4)),
        new cv.Point(-1, -1),
        2
    );

    const blurred = dilated.blur(new cv.Size(10, 10));
    const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY);

    const minPxSize = 100;
    getCoord(thresholded, mat, minPxSize);

    cv.imshow('canny', canny);
    cv.waitKey()
    //cv.imshow('frame', mat);
    cv.waitKey()
    cv.imshow('thresholded', thresholded);
    cv.waitKey()
}

const getCoord = (binaryImg, dstImg, minPxSize, fixedRectWidth) => {
    const {
        centroids,
        stats
    } = binaryImg.connectedComponentsWithStats();

    // pretend label 0 is background
    for (let label = 1; label < centroids.rows; label += 1) {
        const [x1, y1] = [stats.at(label, cv.CC_STAT_LEFT), stats.at(label, cv.CC_STAT_TOP)];
        const [x2, y2] = [
            x1 + (fixedRectWidth || stats.at(label, cv.CC_STAT_WIDTH)),
            y1 + (fixedRectWidth || stats.at(label, cv.CC_STAT_HEIGHT))
        ];
        console.log(x1,y1);
        console.log(x2,y2);
    }

};

