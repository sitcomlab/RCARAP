const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
const ipcMain = require('electron').ipcMain;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let backgroundWindow;
let windowIsOpen = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600
    })

    backgroundWindow = new BrowserWindow({
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

    mainWindow.on('closed', function() {
        mainWindow = null
    })
    backgroundWindow.on('closed', function() {
        backgroundWindow = null
    })
}

app.on('ready', () => {
    //video.setWindowIsOpen(true);
    //video.startVideo();
    // var screenElectron = electron.screen;
    // var mainScreen = screenElectron.getPrimaryDisplay();
    // var dimensions = mainScreen.size;
    // console.log(mainScreen);
    // console.log(dimensions);
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