let windowIsOpen = true;
console.log("starting");
const rs2 = require('node-librealsense/index.js');
//distance in depth image in different colors
const colorizer = new rs2.Colorizer();
const cv = require('opencv4nodejs');
const ipcRenderer = require('electron').ipcRenderer;
const pipeline = new rs2.Pipeline();
const align = new rs2.Align(rs2.stream.STREAM_COLOR);
let clippingDistance = 1.1;
console.log('Press Up/Down to change the depth clipping distance.');
/*console.log(this);
this.window.setKeyCallback((key, scancode, action, modes) => {
    if (action != 0) return;

if (key === 265) {
    // Pressed: Up arrow key
    clippingDistance += 0.1;
    if (clippingDistance > 6.0) {
        clippingDistance = 6.0;
    }
} else if (key === 264) {
    // Pressed: Down arrow key
    clippingDistance -= 0.1;
    if (clippingDistance < 0) {
        clippingDistance = 0;
    }
}
console.log('Depth clipping distance:', clippingDistance.toFixed(3));
});*/

var profile = pipeline.start();

const depthScale = tryGetDepthScale(profile.getDevice());
if (depthScale === undefined) {
    console.error('Device does not have a depth sensor');
    process.exit(1);
}

while (windowIsOpen) {
    const rawFrameset = pipeline.waitForFrames();
    const alignedFrameset = align.process(rawFrameset);
    let colorFrame = alignedFrameset.colorFrame;
    let depthFrame = alignedFrameset.depthFrame;
    if (colorFrame && depthFrame) {
        removeBackground(colorFrame, depthFrame, depthScale, clippingDistance);
        const colorMat = new cv.Mat(colorFrame.data, colorFrame.height, colorFrame.width, cv.CV_8UC3);
        const resizedImg = colorMat.resizeToMax(1280);
		//const colorMat = new cv.Mat(color.data, 1000, 1000, cv.CV_8UC3);
        const outBase64 =  cv.imencode('.jpg', resizedImg).toString('base64');
        ipcRenderer.send('camera-data',{base64String: outBase64});
    }

}
pipeline.stop();
pipeline.destroy();
win.destroy();
rs2.cleanup();

function tryGetDepthScale(dev) {
    const sensors = dev.querySensors();
    for (let i = 0; i < sensors.length; i++) {
        if (sensors[i] instanceof rs2.DepthSensor) {
            return sensors[i].depthScale;
        }
    }
    return undefined;
}

function removeBackground(otherFrame, depthFrame, depthScale, clippingDist) {
    let depthData = depthFrame.getData();
    let otherData = otherFrame.getData();
    const width = otherFrame.width;
    const height = otherFrame.height;
    const otherBpp = otherFrame.bytesPerPixel;

    for (let y = 0; y < height; y++) {
        let depthPixelIndex = y * width;
        for (let x = 0; x < width; x++, ++depthPixelIndex) {
            let pixelDistance = depthScale * depthData[depthPixelIndex];
            if (pixelDistance <= 0 || pixelDistance > clippingDist) {
                let offset = depthPixelIndex * otherBpp;

                // Set pixel to background color
                for (let i = 0; i < otherBpp; i++) {
                    otherData[offset + i] = 0x11;
                }
            }
        }
    }
}