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


