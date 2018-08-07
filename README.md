# SP-RCARAP
Supporting Remote Collaboration with Augmented Reality and Architectural Plans (Summer semester 2018)

# Goal
The goal of the study project "Supporting remote collaboration with Augmented Reality and architectural plans" is to use depth cameras (Intel RealSense D435) in combination with a tabletop system to project the hand of a person pointing on a plan to the second tabletop system in a different room/building. This approach supports architects, for example in decision making processes or discussions. It includes depth information which can be useful in different applications, for example indicating the height of a wall.

# Technologies used
* Nodejs
* Electron
* Socket.io
* OpenCV4nodejs
* librealsense

# How to Run
1. Run npm install
2. Run ./node_modules/.bin/electron-rebuild
3. Run npm start

# Implementation
The application has to be started on both machines. One machine (Machine A) will create a session, the other one (Machine B) will join the session by typing in the IP address of Machine A. After the connection is established the calibration has to activated by clicking "Calibrate" on Machine A (pleae make sure that the light in the room is turned off). That opens the calibration window in Machine B with a countdown of 20 seconds. Within this time the architectural plan has to be align according to the green calibration squares in a way that the bottom left corner of the plan is covered by the bottom left calibration square. After the time is up the calibrate button of Machine B has to be clicked to repeat the process for Machine A. Hereinafter the application is ready to use (Please turn on the lights again). Now you can point on both plans and the hand will be transmitted to the other tabletop system. Additionally the height of the hand above the plan is displayed as well as the finger tips which are recognized.

# Drawbacks
* Computationally intensive so a good processor (>= i5) is required to run it appropriately (for example logging the coordinates of the hands)
* Calibration is dependend on brightness of the room, it has to be dark so the color of the calibration squares can be captured by the cameras correctly
* Depth quality of the Intel RealSense D435 is not very good (fluctuation of depth values between 1-3 centimeters; one camera has difference of 10 centimeters of depth)

# Future work
* Audio transmission
* Improvement of calibration so it is independend of light
* Adjustment of tabletop setup (being able to change angle of projector or mirror directly)
* Inclusion of drawing on the plan (annotations) or highlighting of elements
* Recognition of different persons (i.e. by using gloves with different colors)
* Implementation of gesture recognition