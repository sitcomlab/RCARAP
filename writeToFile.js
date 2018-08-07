/**
 * This file writes the incoming data into a file. The incoming data in this case are the coordinates of the tracked hands
 * icluding the timestamp
 * @type {"fs"} fs is used to stream the data into the file handCoordinates.js
 */
fs = require('fs');
const ipcRenderer = require('electron').ipcRenderer;
var fileStream;
ipcRenderer.on('write-to-file', function (event,data) {
    if(fileStream)
        fileStream.write(data.logText);
});
ipcRenderer.on('create-write-stream', function (event,data) {
    fileStream = fs.createWriteStream(data.filename);
});
ipcRenderer.on('end-write-stream', function (event,data) {
    fileStream.end();
});


