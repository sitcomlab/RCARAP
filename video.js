let windowIsOpen = true;
const rs2 = require('node-librealsense/index.js');
//distance in depth image in different colors
const colorizer = new rs2.Colorizer();
const cv = require('opencv4nodejs');
const ipcRenderer = require('electron').ipcRenderer;
const pipeline = new rs2.Pipeline();
pipeline.start();
while (windowIsOpen) {
    const frameset = pipeline.waitForFrames();
    const depthMap = colorizer.colorize(frameset.depthFrame);
    if (depthMap) {
        const color = frameset.colorFrame;
        const colorMat = new cv.Mat(color.data, color.height, color.width, cv.CV_8UC3);
        ipcRenderer.send('camera-data',{data: colorMat.getData(), rows: colorMat.rows, cols: colorMat.cols});
    }

}
pipeline.stop();
pipeline.destroy();
win.destroy();
rs2.cleanup();