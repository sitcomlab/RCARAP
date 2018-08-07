const rs2 = require('node-librealsense/index.js');
const cv = require('opencv4nodejs');
const fs = require('fs');
const ipcRenderer = require('electron').ipcRenderer;
//distance in depth image in different colors
const pipeline = new rs2.Pipeline();
const colorizer = new rs2.Colorizer();
const align = new rs2.Align(rs2.stream.STREAM_COLOR);
//Post-processing filters
const DFilter = new rs2.DecimationFilter();
const SFilter = new rs2.SpatialFilter();
const TFilter = new rs2.TemporalFilter();
const HFilter = new rs2.HoleFillingFilter();
var isPrinted = false;
let initalClippingDist = 1.21;
let calibrated = false;
let startedStreaming = false;
let gotCoordinates = false;
//minimum maximum values for calibration
let maxX;
let maxY;
let minX;
let minY;
let screenHeight = 1080;
let screenWidth = 1920;
let logCounter = 0;
let logging = false;
//start calibrating
ipcRenderer.on('started-calibrating', function (event) {
    ipcRenderer.send('log', {message: "test, started-calibrating"});
    if (!startedStreaming) {
            stream();
    }
});
//logging
if(logging == true) {
    ipcRenderer.send('create-write-stream', {filename: "handCoordinates.txt"});
}
//start the stream
function stream() {

    ipcRenderer.send('log', {message: "startedStreaming:" + startedStreaming});
    startedStreaming = true;
    const profile = pipeline.start();

    //warmup of the camera during calbration
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
        const alignedFrameset = align.process(rawFrameset);
        let colorFrame = alignedFrameset.colorFrame;
        let depthFrame = alignedFrameset.depthFrame;
        if (colorFrame && depthFrame) {
            if (!calibrated && !temp) {
                temp = true;
                const calibrationColorMat = new cv.Mat(colorFrame.data, colorFrame.height, colorFrame.width, cv.CV_8UC3);
                colorDetection(calibrationColorMat);
                calibrated = true;
            } else {
                //filters for post-processing (optional: activate if desires but slow down the stream)
                //let filtered = DFilter.process(depthFrame);
                //filtered = SFilter.process(depthFrame);
                //filtered = TFilter.process(depthFrame);
                //filtered = HFilter.process(depthFrame);
                //removeBackground(colorFrame, depthFrame, depthScale);

                //crop color stream
                const colorMat = new cv.Mat(colorFrame.data, colorFrame.height, colorFrame.width, cv.CV_8UC3);
                let croppedIMG = colorMat.getRegion(new cv.Rect(minX, minY, maxX-minX, maxY-minY));
                let result = croppedIMG.resize(screenHeight,screenWidth);

                //crop depth stream
                let depthMat = new cv.Mat(depthFrame.data, depthFrame.height, depthFrame.width, cv.CV_16SC1);
                let croppedDepthFrame = depthMat.getRegion(new cv.Rect(minX, minY, maxX-minX, maxY-minY));
                let resizedDepthFrame = croppedDepthFrame.resize(screenHeight, screenWidth);

                //recognize hands in cropped stream
                let result2 = recognizeHands(result, resizedDepthFrame, depthScale);

                logCounter++;

                //convert color of result stream
                const result3 = result2.cvtColor(cv.COLOR_BGR2RGBA);

                //send to other machine
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

//getting the depth scale
function tryGetDepthScale(dev) {
    const sensors = dev.querySensors();
    for (let i = 0; i < sensors.length; i++) {
        if (sensors[i] instanceof rs2.DepthSensor) {
            return sensors[i].depthScale;
        }
    }
    return undefined;
}

//remove background based on clipping distance (optional: include if desired)
function removeBackground(otherFrame, depthFrame, depthScale) {
    let depthData = depthFrame.getData();
    let otherData = otherFrame.getData();
    const width = otherFrame.width;
    const height = otherFrame.height;
    const otherBpp = otherFrame.bytesPerPixel;
    for (let y = 0; y < height; y++) {
        let depthPixelIndex = y * width;
        for (let x = 0; x < width; x++, ++depthPixelIndex) {
            let pixelDistance = depthScale * depthData[depthPixelIndex];
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
//function for recognizing the hands in the color matrix of the realsense stream
function recognizeHands(colorMat, depthFrame, depthScale) {
// segmenting by skin color (could be adjsuted for different skin colors)
    const skinColorUpper = hue => new cv.Vec(hue, 0.8 * 255, 0.6 * 255);
    const skinColorLower = hue => new cv.Vec(hue, 0.1 * 255, 0.05 * 255);

    //function to create the hand mask in the stream
    const makeHandMask = (img) => {
        // filter by skin color
        const imgHLS = img.cvtColor(cv.COLOR_RGB2HLS);
        const rangeMask = imgHLS.inRange(skinColorLower(0), skinColorUpper(50));

        // remove noise
        const blurred = rangeMask.blur(new cv.Size(5, 5));
        const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY);
        return thresholded;
    };

    //save every hand contour in an array
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
        const { labels } = cv.partition(hullPoints, ptsBelongToSameCluster);
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

    const getMostCentralPointHands = (pointGroup) => {
        // find center
        const center = getCenterPt(pointGroup.map(ptWithIdx => ptWithIdx.pt));
        // sort ascending by distance to center
        return pointGroup.sort(
            (ptWithIdx1, ptWithIdx2) => ptDist(ptWithIdx1.pt, center) - ptDist(ptWithIdx2.pt, center)
        )[0];
    };

    //colors for displaying infos in the stream
    const blue = new cv.Vec(255, 0, 0);
    const green = new cv.Vec(0, 255, 0);
    const red = new cv.Vec(0, 0, 255);
    const col1 = new cv.Vec(255,255,178);
    const col2 = new cv.Vec(254,204,92);
    const col3 = new cv.Vec(253,141,60);
    const col4 = new cv.Vec(240,59,32);
    const col5 = new cv.Vec(189,0,38);

    const resizedImg = colorMat.resize(screenHeight,screenWidth);

    const handMask = makeHandMask(resizedImg);
    const handContour = getHandContour(handMask);

    if (!handContour) {
        return;
    }
    const maxPointDist = 25;
    const maxAngleDeg = 60;
    let result = resizedImg.copy(handMask);

    for(var i=0;i<handContour.length;i++) {
        //getting the hull of the hand contour with the fingertips
        let hullIndices = getRoughHull(handContour[i], maxPointDist);
        //getting the central point of the hand contour
        let moments = handContour[i].moments();
        let centerX = moments.m10/moments.m00;
        let centerY = moments.m01/moments.m00;

        // get defect points of hull to contour and return vertices
        // of each hull point to its defect points
        let vertices = getHullDefectVertices(handContour[i], hullIndices);

        // fingertip points are those which have a sharp angle to its defect points
        let verticesWithValidAngle = filterVerticesByAngle(vertices, maxAngleDeg);

        //compute the distance from the table to the hand
        let depthValue = depthFrame.at(centerY, centerX);
        let pixelDistance = depthScale * depthValue;
        let pixelDistToTable = (initalClippingDist - pixelDistance).toFixed(2);

        // show distance from table to hand inside displayed matrix
        result.putText(
            String(pixelDistToTable),
            new cv.Point(centerX,centerY),
            cv.FONT_ITALIC,
            1.2, {
                color: pixelDistToTable <= 0.2 ? col1 : pixelDistToTable <= 0.4 ? col2 : pixelDistToTable <= 0.6 ? col3 : pixelDistToTable <= 0.8 ? col4 : col5,
                thickness: 2
            }
        );

        // log the coordinates and distance in a new file (optional; set logging to true if desired)
        if(logCounter %30 == 0 && logging == true){
            ipcRenderer.send('write-to-file', {logText: "x coordinate: " + centerX + ", y coordinate: " + centerY + ", Distance to table: " + pixelDistToTable + " Time: " + new Date().toUTCString() + "\n"});
        }

        // draw circles around fingertips
        verticesWithValidAngle.forEach((v) => {

            /* distance from table to fingertips
            let depthValue2 = depthFrame.at(v.pt.y, v.pt.x);
            let pixelDistance2 = depthScale * depthValue2;
            let pixelDistToTable2 = (initalClippingDist - pixelDistance2).toFixed(2);*/

            result.drawEllipse(
            new cv.RotatedRect(v.pt, new cv.Size(5, 5), 0), {
                color: green,
                thickness: 2
            }
            );
        });
    }
    return result;
}

//detect squares in a binary matrix with a canny filter
//used only in calibration mode
function detectSquares(mat) {
    let canny = mat.canny(100, 255, 3, false);

    const dilated = canny.dilate(
        cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(4, 4)),
        new cv.Point(-1, -1),
        2
    );

    const blurred = dilated.blur(new cv.Size(5, 5));
    const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY);

    //minimal size for squares to get detected
    const minPxSize = 100;
    if(gotCoordinates == false){
        gotCoordinates = true;
        getCoord(thresholded, mat, minPxSize);
    }
}

//get maximal and minimal x and y coordinates of all squares
//compute max and min of all coordinates
//used only in calibration mode
const getCoord = (binaryImg, dstImg, minPxSize, fixedRectWidth) =>
{
    const {
        centroids,
        stats
    } = binaryImg.connectedComponentsWithStats();

    let counter = 0;
    let coordX = [];
    let coordY = [];

    for (let label = 1; label < centroids.rows; label += 1) {
        const [x1, y1] = [stats.at(label, cv.CC_STAT_LEFT), stats.at(label, cv.CC_STAT_TOP)];
        const [x2, y2] = [
            x1 + (fixedRectWidth || stats.at(label, cv.CC_STAT_WIDTH)),
            y1 + (fixedRectWidth || stats.at(label, cv.CC_STAT_HEIGHT))
        ];
        const blue = new cv.Vec(255, 0, 0);
        const size = stats.at(label, cv.CC_STAT_AREA);
        if (minPxSize < size) {
            counter++;
            coordX.push(x1, x2);
            coordY.push(y1, y2);
        }
    }
    maxX = Math.max(...coordX);
    maxY = Math.max(...coordY);
    minX = Math.min(...coordX);
    minY = Math.min(...coordY);
    //logs of the found min and max coordinates
    // ipcRenderer.send('log', {message: "coordX:"+coordX});
    // ipcRenderer.send('log', {message: "coordY:"+coordY});
    // ipcRenderer.send('log', {message: "minX:"+minX+" maxX: "+maxX});
}

//detect color between specified threshold values
//used only in calibration mode
function colorDetection(mat){
    const imgHSV = mat.cvtColor(cv.COLOR_BGR2HSV);
    lower_hsv_threshold = new cv.Vec3(40, 40, 40);
    upper_hsv_threshold = new cv.Vec3(80, 255, 255);

    const testMat = imgHSV.inRange(lower_hsv_threshold,upper_hsv_threshold);
    detectSquares(testMat);
}