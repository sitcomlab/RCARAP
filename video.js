// TODO Allignment not working properly (precise) --> Projection is stretched to boarders,
// TODO LIGHT (Rectangle brightness)
const rs2 = require('node-librealsense/index.js');
const cv = require('opencv4nodejs');
const fs = require('fs');
const ipcRenderer = require('electron').ipcRenderer;
//distance in depth image in different colors
const pipeline = new rs2.Pipeline();
const colorizer = new rs2.Colorizer();
const align = new rs2.Align(rs2.stream.STREAM_COLOR);
const DFilter = new rs2.DecimationFilter();
const SFilter = new rs2.SpatialFilter();
const TFilter = new rs2.TemporalFilter();
const HFilter = new rs2.HoleFillingFilter();
var isPrinted = false;
let initalClippingDist = 1.21;
let calibrated = false;
let startedStreaming = false;
let gotCoordinates = false;
let maxX;
let maxY;
let minX;
let minY;
let screenHeight = 1080;
let screenWidth = 1920;
let shouldStream = true;
//let coordinateLog = "";
let logCounter = 0;
let logging = false;
let adjusted = false;
ipcRenderer.on('started-calibrating', function (event) {
    ipcRenderer.send('log', {message: "test, started-calibrating"});
    if (!startedStreaming) {
            stream();
    }
});

ipcRenderer.send('create-write-stream', {filename: "handCoordinates.txt"});

//console.log('Press Up/Down to change the depth clipping distance.');
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
function stream() {

    ipcRenderer.send('log', {message: "startedStreaming:" + startedStreaming});
    startedStreaming = true;
    const profile = pipeline.start();

    for(let i = 0; i < 600; i++)
    {
        //Wait for all configured streams to produce a frame
        pipeline.waitForFrames();
    }

    const depthScale = tryGetDepthScale(profile.getDevice());
    if (depthScale === undefined) {
        console.error('Device does not have a depth sensor');
        process.exit(1);
    }
    let temp = false;
    while (true) {
        const rawFrameset = pipeline.waitForFrames();
        //ipcRenderer.send('log', {message: "rawheight: " + rawFrameset.colorFrame.height + "  rawwidth: "+rawFrameset.colorFrame.width});
        const alignedFrameset = align.process(rawFrameset);
        let colorFrame = alignedFrameset.colorFrame;
        // let depthFrame = alignedFrameset.depthFrame;
        let depthFrame = alignedFrameset.depthFrame;
        //ipcRenderer.send('log', {message: "temp: " + temp + "  cli: "+calibrated});
        if (colorFrame && depthFrame) {
            if (!calibrated && !temp) {
                temp = true;
                const calibrationColorMat = new cv.Mat(colorFrame.data, colorFrame.height, colorFrame.width, cv.CV_8UC3);
                ipcRenderer.send('log', {message: "height: " + colorFrame.height + "  width: "+colorFrame.width});
                colorDetection(calibrationColorMat);
                calibrated = true;
                //Resize colormat

            } else {
                //let filtered = DFilter.process(depthFrame);
                //filtered = SFilter.process(depthFrame);
                //filtered = TFilter.process(depthFrame);
                //filtered = HFilter.process(depthFrame);
                //ipcRenderer.send('log', {message: "test"});
                //removeBackground(colorFrame, depthFrame, depthScale);
                const colorMat = new cv.Mat(colorFrame.data, colorFrame.height, colorFrame.width, cv.CV_8UC3);
                let croppedIMG = colorMat.getRegion(new cv.Rect(minX, minY, maxX-minX, maxY-minY));
                //cv.imshow("crop",croppedIMG);

                //cv.waitKey(1);

                let result = croppedIMG.resize(screenHeight,screenWidth);
                let depthMat = new cv.Mat(depthFrame.data, depthFrame.height, depthFrame.width, cv.CV_16SC1);
                let croppedDepthFrame = depthMat.getRegion(new cv.Rect(minX, minY, maxX-minX, maxY-minY));
                let resizedDepthFrame = croppedDepthFrame.resize(screenHeight, screenWidth);
                //ipcRenderer.send('log', {message: "color Mat: "+ result.cols +" "+ result.rows});
                //ipcRenderer.send('log', {message: "depth Mat: "+ resizedDepthFrame.cols +" "+ resizedDepthFrame.rows});
                //let resizedDepthFrame2 = resizedDepthFrame.convertTo(cv.CV_8UC3);
                // if(!adjusted) {
                //     adjusted = true;
                //     for (let i = 0; i < 600; i++) {
                //         //Wait for all configured streams to produce a frame
                //         pipeline.waitForFrames();
                //         const outBase64 = cv.imencode('.jpg', result).toString('base64');
                //         ipcRenderer.send('camera-data', {base64String: outBase64});
                //     }
                // }
                let result2 = recognizeHands(result, resizedDepthFrame, depthScale);
                //cv.imshow("depthFrame",resizedDepthFrame2);
                //cv.waitKey(1);
                logCounter++;
                const result3 = result2.cvtColor(cv.COLOR_BGR2RGB);

                if(result3) {
                    const outBase64 = cv.imencode('.jpg', result3).toString('base64');
                    ipcRenderer.send('camera-data', {base64String: outBase64});
                }
            }
        }

    }
    pipeline.stop();
    pipeline.destroy();
    rs2.cleanup();
}

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

function recognizeHands(colorMat, depthFrame, depthScale) {
// segmenting by skin color (has to be adjusted)
    const skinColorUpper = hue => new cv.Vec(hue, 0.8 * 255, 0.6 * 255);
    const skinColorLower = hue => new cv.Vec(hue, 0.1 * 255, 0.05 * 255);

    const makeHandMask = (img) => {
        // filter by skin color
        const imgHLS = img.cvtColor(cv.COLOR_RGB2HLS);
        const rangeMask = imgHLS.inRange(skinColorLower(0), skinColorUpper(50));

        // remove noise
        const blurred = rangeMask.blur(new cv.Size(5, 5));
        const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY);
        return thresholded;
    };

    const getHandContour = (handMask) => {
        const mode = cv.RETR_EXTERNAL;
        const method = cv.CHAIN_APPROX_SIMPLE;
        const contours = handMask.findContours(mode, method);
        // largest contour
        let handContours = [];
        //count up if there are more hands
        contours.sort((c0, c1) => c1.area - c0.area);
        for(var hands=0;hands<contours.length;hands++){
                handContours.push(contours[hands]);
        }
        //return contours.sort((c0, c1) => c1.area - c0.area)[0];
        return handContours;
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
        try{
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
    }
    catch (e){
        //ipcRenderer.send('log', {message: "try catch event: " + e});
        return [];
    }
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
    const col1 = new cv.Vec(255,255,178);
    const col2 = new cv.Vec(254,204,92);
    const col3 = new cv.Vec(253,141,60);
    const col4 = new cv.Vec(240,59,32);
    const col5 = new cv.Vec(189,0,38);

// main
    const delay = 20;
    //const resizedImg = colorMat.resizeToMax(1280);
    const resizedImg = colorMat.resize(screenHeight,screenWidth);

//            while(true){
    const handMask = makeHandMask(resizedImg);
    const handContour = getHandContour(handMask);

    if (!handContour) {
        return;
    }
    const maxPointDist = 25;
    const maxAngleDeg = 60;
    let result = resizedImg.copy(handMask);

    for(var i=0;i<handContour.length;i++) {
        let hullIndices = getRoughHull(handContour[i], maxPointDist);

// get defect points of hull to contour and return vertices
// of each hull point to its defect points
        let vertices = getHullDefectVertices(handContour[i], hullIndices);

// fingertip points are those which have a sharp angle to its defect points
        let verticesWithValidAngle = filterVerticesByAngle(vertices, maxAngleDeg);


// draw bounding box and center line
//     resizedImg.drawContours(
//         [handContour],
//         blue, {
//             thickness: 2
//         }
//     );

// draw points and vertices
        verticesWithValidAngle.forEach((v) => {
            //     resizedImg.drawLine(
            //     v.pt,
            //     v.d1, {
            //         color: green,
            //         thickness: 2
            //     }
            // );
            // resizedImg.drawLine(
            //     v.pt,
            //     v.d2, {
            //         color: green,
            //         thickness: 2
            //     }
            // );
            // resizedImg.drawEllipse(
            //     new cv.RotatedRect(v.pt, new cv.Size(20, 20), 0), {
            //         color: red,
            //         thickness: 2
            //     }
            // );
            //let depthData = depthFrame.getData();
           // ipcRenderer.send('log', {message: "x coordinates: " + v.pt.x + "y coordinates: " + v.pt.y});
            let depthValue = depthFrame.at(v.pt.y, v.pt.x);
            let pixelDistance = depthScale * depthValue;
            let pixelDistToTable = (initalClippingDist - pixelDistance).toFixed(2);
            // TODO use fs.createWriteStream or move it to different process
           /** coordinateLog += "x coordinate: " + v.pt.x + ", y coordinate: " + v.pt.y + ", Distance to table: " + pixelDistToTable + "\n";
            if(logCounter %200 == 0){
                fs.appendFileSync('handCoordinates.txt',coordinateLog,function (err) {
                    if (err) throw err;
                });
                logCounter = 200;
                coordinateLog = "";
            }
            **/
           if(logCounter %30 == 0 && logging == true){
               ipcRenderer.send('write-to-file', {logText: "x coordinate: " + v.pt.x + ", y coordinate: " + v.pt.y + ", Distance to table: " + pixelDistToTable + " Time: " + new Date().toUTCString() + "\n"});
           }
            result.drawEllipse(
            new cv.RotatedRect(v.pt, new cv.Size(20, 20), 0), {
                color: pixelDistToTable <= 0.2 ? col1 : pixelDistToTable <= 0.4 ? col2 : pixelDistToTable <= 0.6 ? col3 : pixelDistToTable <= 0.8 ? col4 : col5,
                thickness: 2
            }
            );

            result.putText(
                String(pixelDistToTable),
                new cv.Point(v.pt.x + 25,v.pt.y),
                cv.FONT_ITALIC,
                0.5, {
                color: pixelDistToTable <= 0.2 ? col1 : pixelDistToTable <= 0.4 ? col2 : pixelDistToTable <= 0.6 ? col3 : pixelDistToTable <= 0.8 ? col4 : col5,
                thickness: 2
                }
            );
        });


// display detection result
//     const numFingersUp = verticesWithValidAngle.length;
//     result.drawRectangle(
//         new cv.Point(10, 10),
//         new cv.Point(70, 70), {
//             color: green,
//             thickness: 2
//         }
//     );
//
//     const fontScale = 2;
//     result.putText(
//         String(numFingersUp),
//         new cv.Point(20, 60),
//         cv.FONT_ITALIC,
//         fontScale, {
//             color: green,
//             thickness: 2
//         }
//     );
//
//     const {
//         rows,
//         cols
//     } = result;
        //resultArray.push(result);
    }
    return result;
}

function detectSquares(mat) {
    let canny = mat.canny(100, 255, 3, false); //(200,255,3,false)
    //const canny = ca.resize(750,1300);
    //cv.imshow("canny",canny);
    //cv.waitKey();

    const dilated = canny.dilate(
        cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(4, 4)),
        new cv.Point(-1, -1),
        2
    );

    const blurred = dilated.blur(new cv.Size(5, 5)); //for getting just 4 rectangles
    const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY);

    const minPxSize = 100;
    if(gotCoordinates == false){
        gotCoordinates = true;
        getCoord(thresholded, mat, minPxSize);
    }
}

const getCoord = (binaryImg, dstImg, minPxSize, fixedRectWidth) =>
{
    const {
        centroids,
        stats
    } = binaryImg.connectedComponentsWithStats();

    let counter = 0;
    let coordX = [];
    let coordY = [];
    

    // pretend label 0 is background
    for (let label = 1; label < centroids.rows; label += 1) {
        const [x1, y1] = [stats.at(label, cv.CC_STAT_LEFT), stats.at(label, cv.CC_STAT_TOP)];
        const [x2, y2] = [
            x1 + (fixedRectWidth || stats.at(label, cv.CC_STAT_WIDTH)),
            y1 + (fixedRectWidth || stats.at(label, cv.CC_STAT_HEIGHT))
        ];
        ipcRenderer.send('log', {message: "counter: " + counter});
        //console.log(x1,y1);
        //console.log(x2,y2);
        const blue = new cv.Vec(255, 0, 0);
        const size = stats.at(label, cv.CC_STAT_AREA);
        if (minPxSize < size) {
            counter++;
            dstImg.drawRectangle(
                new cv.Point(x1, y1),
                new cv.Point(x2, y2),
                {color: blue, thickness: 2}
            );
            //if (counter <= 4) {
                coordX.push(x1, x2);
                coordY.push(y1, y2);
           // }
        }
    }
    //ipcRenderer.send('log', {message: "coordArray:"+coordArray});
    maxX = Math.max(...coordX);
    maxY = Math.max(...coordY);
    minX = Math.min(...coordX);
    minY = Math.min(...coordY);
    // maxX += 20; Buffer from transmission
    // maxY += 20;
    // minX -= 20;
    // minY -= 20;
    ipcRenderer.send('log', {message: "coordX:"+coordX});
    ipcRenderer.send('log', {message: "coordY:"+coordY});
    ipcRenderer.send('log', {message: "minX:"+minX+" maxX: "+maxX});

    //const dsI = dstImg.resize(750,1300);
    //cv.imshow('hehetz', dsI);
    //cv.waitKey();
}

const drawRect = (image, rect, color, opts = { thickness: 2 }) =>
image.drawRectangle(
    rect,
    color,
    opts.thickness,
    cv.LINE_8
);

function colorDetection(mat){
    const imgHSV = mat.cvtColor(cv.COLOR_BGR2HSV);
    lower_hsv_threshold = new cv.Vec3(40, 40, 40); //green:60,255,255
    upper_hsv_threshold = new cv.Vec3(80, 255, 255);

    const testMat = imgHSV.inRange(lower_hsv_threshold,upper_hsv_threshold);
    //const tstM = testMat.resize(750,1300);
    detectSquares(testMat);
}