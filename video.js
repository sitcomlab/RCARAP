let windowIsOpen = true;
console.log("starting");
const rs2 = require('node-librealsense/index.js');
//distance in depth image in different colors
const colorizer = new rs2.Colorizer();
const cv = require('opencv4nodejs');
const ipcRenderer = require('electron').ipcRenderer;
const pipeline = new rs2.Pipeline();
const align = new rs2.Align(rs2.stream.STREAM_COLOR);
const electron = require('electron');
var isPrinted = false;
let initalClippingDist = 1.1;
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
        removeBackground(colorFrame, depthFrame, depthScale);
        const colorMat = new cv.Mat(colorFrame.data, colorFrame.height, colorFrame.width, cv.CV_8UC3);

        let result = recognizeHands(colorMat);

        const outBase64 =  cv.imencode('.jpg', result).toString('base64');
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

function removeBackground(otherFrame, depthFrame, depthScale) {
    let depthData = depthFrame.getData();
    let otherData = otherFrame.getData();
    const width = otherFrame.width;
    const height = otherFrame.height;
    const otherBpp = otherFrame.bytesPerPixel;
    console.log("backrground remove");
    for (let y = 0; y < height; y++) {
        let depthPixelIndex = y * width;
        for (let x = 0; x < width; x++, ++depthPixelIndex) {
            let pixelDistance = depthScale * depthData[depthPixelIndex];
            //var factor = 0.065;
            //clippingDist = initalClippingDist - (y/100) * factor;
            //if(!isPrinted)
                //ipcRenderer.send('log',{message: clippingDist + " pixelDistance: " + pixelDistance});
            if (pixelDistance <= 0 || pixelDistance > initalClippingDist) {
                let offset = depthPixelIndex * otherBpp;

                // Set pixel to background color
                for (let i = 0; i < otherBpp; i++) {
                    otherData[offset + i] = 0x11;
                }
            }
        }
    }
    isPrinted = true;
}

function recognizeHands(colorMat) {
// segmenting by skin color (has to be adjusted)
    const skinColorUpper = hue => new cv.Vec(hue, 0.8 * 255, 0.6 * 255);
    const skinColorLower = hue => new cv.Vec(hue, 0.1 * 255, 0.05 * 255);

    const makeHandMask = (img) => {
        // filter by skin color
        const imgHLS = img.cvtColor(cv.COLOR_RGB2HLS);
        const rangeMask = imgHLS.inRange(skinColorLower(5), skinColorUpper(80));

        // remove noise
        const blurred = rangeMask.blur(new cv.Size(10, 10));
        const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY);
        return thresholded;
    };

    const getHandContour = (handMask) => {
        const mode = cv.RETR_EXTERNAL;
        const method = cv.CHAIN_APPROX_SIMPLE;
        const contours = handMask.findContours(mode, method);
        // largest contour
        return contours.sort((c0, c1) => c1.area - c0.area)[0];
    };

// returns distance of two points
    const ptDist = (pt1, pt2) => pt1.sub(pt2).norm();

// returns center of all points
    const getCenterPt = pts => pts.reduce(
        (sum, pt) => sum.add(pt),
        new cv.Point(0, 0)
    ).div(pts.length);

// get the polygon from a contours hull such that there
// will be only a single hull point for a local neighborhood
    const getRoughHull = (contour, maxDist) => {
        // get hull indices and hull points
        const hullIndices = contour.convexHullIndices();
        const contourPoints = contour.getPoints();
        const hullPointsWithIdx = hullIndices.map(idx => ({
            pt: contourPoints[idx],
            contourIdx: idx
        }));
        const hullPoints = hullPointsWithIdx.map(ptWithIdx => ptWithIdx.pt);

        // group all points in local neighborhood
        const ptsBelongToSameCluster = (pt1, pt2) => ptDist(pt1, pt2) < maxDist;
        const {
            labels
        } = cv.partition(hullPoints, ptsBelongToSameCluster);
        const pointsByLabel = new Map();
        labels.forEach(l => pointsByLabel.set(l, []));
        hullPointsWithIdx.forEach((ptWithIdx, i) => {
            const label = labels[i];
            pointsByLabel.get(label).push(ptWithIdx);
        });

        // map points in local neighborhood to most central point
        const getMostCentralPoint = (pointGroup) => {
            // find center
            const center = getCenterPt(pointGroup.map(ptWithIdx => ptWithIdx.pt));
            // sort ascending by distance to center
            return pointGroup.sort(
                (ptWithIdx1, ptWithIdx2) => ptDist(ptWithIdx1.pt, center) - ptDist(ptWithIdx2.pt, center)
            )[0];
        };
        const pointGroups = Array.from(pointsByLabel.values());
        // return contour indeces of most central points
        return pointGroups.map(getMostCentralPoint).map(ptWithIdx => ptWithIdx.contourIdx);
    };

    const getHullDefectVertices = (handContour, hullIndices) => {
        const defects = handContour.convexityDefects(hullIndices);
        const handContourPoints = handContour.getPoints();

        // get neighbor defect points of each hull point
        const hullPointDefectNeighbors = new Map(hullIndices.map(idx => [idx, []]));
        defects.forEach((defect) => {
            const startPointIdx = defect.at(0);
            const endPointIdx = defect.at(1);
            const defectPointIdx = defect.at(2);
            hullPointDefectNeighbors.get(startPointIdx).push(defectPointIdx);
            hullPointDefectNeighbors.get(endPointIdx).push(defectPointIdx);
        });

        return Array.from(hullPointDefectNeighbors.keys())
        // only consider hull points that have 2 neighbor defects
            .filter(hullIndex => hullPointDefectNeighbors.get(hullIndex).length > 1)
            // return vertex points
            .map((hullIndex) => {
                const defectNeighborsIdx = hullPointDefectNeighbors.get(hullIndex);
                return ({
                    pt: handContourPoints[hullIndex],
                    d1: handContourPoints[defectNeighborsIdx[0]],
                    d2: handContourPoints[defectNeighborsIdx[1]]
                });
            });
    };

    const filterVerticesByAngle = (vertices, maxAngleDeg) =>
        vertices.filter((v) => {
            const sq = x => x * x;
            const a = v.d1.sub(v.d2).norm();
            const b = v.pt.sub(v.d1).norm();
            const c = v.pt.sub(v.d2).norm();
            const angleDeg = Math.acos(((sq(b) + sq(c)) - sq(a)) / (2 * b * c)) * (180 / Math.PI);
            return angleDeg < maxAngleDeg;
        });

    const blue = new cv.Vec(255, 0, 0);
    const green = new cv.Vec(0, 255, 0);
    const red = new cv.Vec(0, 0, 255);

// main
    const delay = 20;
    //const resizedImg = colorMat.resizeToMax(1280);
    //let resizedImg;
    //cv.Resize(colorMat,resizedImg,1280,2);
    const resizedImg = colorMat.resize(1080,1920);

//            while(true){
    const handMask = makeHandMask(resizedImg);
    const handContour = getHandContour(handMask);

    if (!handContour) {
        return;
    }

    const maxPointDist = 25;
    const hullIndices = getRoughHull(handContour, maxPointDist);

// get defect points of hull to contour and return vertices
// of each hull point to its defect points
    const vertices = getHullDefectVertices(handContour, hullIndices);

// fingertip points are those which have a sharp angle to its defect points
    const maxAngleDeg = 60;
    const verticesWithValidAngle = filterVerticesByAngle(vertices, maxAngleDeg);

    const result = resizedImg.copy();
// draw bounding box and center line
    resizedImg.drawContours(
        [handContour],
        blue, {
            thickness: 2
        }
    );

// draw points and vertices
    verticesWithValidAngle.forEach((v) => {
        resizedImg.drawLine(
            v.pt,
            v.d1, {
                color: green,
                thickness: 2
            }
        );
        resizedImg.drawLine(
            v.pt,
            v.d2, {
                color: green,
                thickness: 2
            }
        );
        resizedImg.drawEllipse(
            new cv.RotatedRect(v.pt, new cv.Size(20, 20), 0), {
                color: red,
                thickness: 2
            }
        );
        result.drawEllipse(
            new cv.RotatedRect(v.pt, new cv.Size(20, 20), 0), {
                color: red,
                thickness: 2
            }
        );
    });


// display detection result
    const numFingersUp = verticesWithValidAngle.length;
    result.drawRectangle(
        new cv.Point(10, 10),
        new cv.Point(70, 70), {
            color: green,
            thickness: 2
        }
    );

    const fontScale = 2;
    result.putText(
        String(numFingersUp),
        new cv.Point(20, 60),
        cv.FONT_ITALIC,
        fontScale, {
            color: green,
            thickness: 2
        }
    );

    const {
        rows,
        cols
    } = result;

    return result;
}