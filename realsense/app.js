#!/usr/bin/env node

// Copyright (c) 2017 Intel Corporation. All rights reserved.
// Use of this source code is governed by an Apache 2.0 license
// that can be found in the LICENSE file.

'use strict';

const cv = require('opencv4nodejs');

const rs2 = require('node-librealsense/index.js');
const {GLFWWindow} = require('node-librealsense/examples/glfw-window.js');
const {glfw} = require('node-librealsense/examples/glfw-window.js');


// A GLFW Window to display the captured image
const win = new GLFWWindow(1280, 720, 'Node.js Capture Example');

// Colorizer is used to map distance in depth image into different colors
const colorizer = new rs2.Colorizer();

// The main work pipeline of camera
const pipeline = new rs2.Pipeline();

// Start the camera
pipeline.start();

while (! win.shouldWindowClose()) {
  const frameset = pipeline.waitForFrames();
  // Build the color map
  const depthMap = colorizer.colorize(frameset.depthFrame);
  if (depthMap) {
    // Paint the images onto the window
    win.beginPaint();
    const color = frameset.colorFrame;
    //const gray = cv.cvtColor(color, cv.COLOR_BGR2GRAY);
    glfw.draw2x2Streams(win.window, 2, 
      depthMap.data, 'rgb8', depthMap.width, depthMap.height,
      color.data, 'rgb8', color.width, color.height);

    const sideBySide = new cv.Mat(color.data,color.height, color.width, cv.CV_8UC3);
    const test = sideBySide.bgrToGray();
    //console.log(sideBySide);
    win.endPaint();
    cv.imshow('a window name', test)
  }
}

pipeline.stop();
pipeline.destroy();
win.destroy();
rs2.cleanup();
