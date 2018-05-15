let windowIsOpen = false;
const cv = require('opencv4nodejs');
const rs2 = require('node-librealsense/index.js');
const {GLFWWindow} = require('./glfw-window.js'); //for demo, visualiazation will be the projection
const win = new GLFWWindow(1280, 720, 'Node.js Capture Example');

//distance in depth image in different colors
const colorizer = new rs2.Colorizer();

const pipeline = new rs2.Pipeline();

module.exports = {
    startVideo: function() {
        pipeline.start();
        while (windowIsOpen) {
            const frameset = pipeline.waitForFrames();
            const depthMap = colorizer.colorize(frameset.depthFrame);
            if (depthMap) {
                //win.beginPaint();
                const color = frameset.colorFrame;
                const colorMat = new cv.Mat(color.data, color.height, color.width, cv.CV_8UC3);
                /*
                * TODO
                * Process video data here, e.g. hand recognition
                *
                * TODO
                * Send processed video data via peer here
                */
                cv.imshow('cv demo', colorMat); //for demo, visualiazation will be the projection
                win.endPaint();
            }
        }

        pipeline.stop();
        pipeline.destroy();
        win.destroy();
        rs2.cleanup();
    },
    setWindowIsOpen: function(val) {
        windowIsOpen = val;
    }
};