const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
const ipcMain = require('electron').ipcMain;
const util = require("util");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let backgroundWindow;
//let keepStreaming = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600
    })

    backgroundWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true
    })

    backgroundWindow2 = new BrowserWindow({
        width: 800,
        height: 600,
        show: false
    })

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))
    backgroundWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'background.html'),
        protocol: 'file:',
        slashes: true
    }))

    backgroundWindow2.loadURL(url.format({
        pathname: path.join(__dirname, 'background2.html'),
        protocol: 'file:',
        slashes: true
    }))

    mainWindow.on('closed', function() {
        mainWindow = null
    })
    backgroundWindow.on('closed', function() {
        backgroundWindow = null
    })
    backgroundWindow2.on('closed', function() {
        backgroundWindow2 = null
    })
}

app.on('ready', () => {
    createWindow();
    
})

app.on('window-all-closed', function() {
    //video.setWindowIsOpen(false);
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function() {
    if (mainWindow === null) {
        createWindow()
    }
})

ipcMain.on('camera-data', function(event, data) {
  mainWindow.webContents.send('camera-data', data)
});
ipcMain.on('log', function(event, data) {
    console.log(data.message);
});
ipcMain.on('started-calibrating', function(event) {
    backgroundWindow.webContents.send('started-calibrating')
});

ipcMain.on('write-to-file', function(event,data) {
    backgroundWindow2.webContents.send('write-to-file', data)
});
ipcMain.on('create-write-stream', function(event,data) {
    backgroundWindow2.webContents.send('create-write-stream', data)
});
ipcMain.on('end-streaming', function(event, data) {
    backgroundWindow2.webContents.send('end-write-stream', data)
});

ipcMain.on('logObject', function(event, data) {
    console.log(util.inspect(data.data,false,null));
});