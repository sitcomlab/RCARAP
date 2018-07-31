fs = require('fs');
const ipcRenderer = require('electron').ipcRenderer;

ipcRenderer.on('write-to-file', function (event,data) {
    console.log(data);
    fs.appendFileSync(data.filename,data.logText,function (err) {
        if (err) throw err;
    });
});


