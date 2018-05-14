const cv = require('opencv4nodejs');


const rows = 100; // height
const cols = 100; // width

// empty Mat
const emptyMat = new cv.Mat(rows, cols, cv.CV_8UC3);

// fill the Mat with default value
const whiteMat = new cv.Mat(640, 480, cv.CV_8UC1, 255);
const blueMat = new cv.Mat(rows, cols, cv.CV_8UC3, [255, 0, 0]);

cv.imshow('a window name', whiteMat);
cv.waitKey();