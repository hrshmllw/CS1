// Agora.io Web SDK config credentials
const APP_ID = "0814c9b1c6bb4a7aae18007e82a33091"
const TOKEN = "007eJxTYHg/KWLRBHX5JJXCrtSYqRcdn0l7/Yw+VNMR98pAc2luvY0Cg4GFoUmyZZJhsllSkkmieWJiqqGFgYF5qoVRorGxgaXhkprW5IZARobcRiNGRgYIBPG5GHIyy1KLS4pSE3MZGADWdSDh"
const CHANNEL = "livestream"

// MediaPipe variables for input, output, and FPS control
const controlsElement = document.getElementsByClassName('control')[0];
const video = document.getElementsByClassName('input_video')[0];
const out = document.getElementsByClassName('output')[0];
const canvasCtx = out.getContext('2d');
const fpsControl = new FPS();

// Create instance of Agora SDK engine
const client = AgoraRTC.createClient({mode:'rtc', 'codec':"vp8"})

// Microphone and camera
let mic, camera;

// Empty array instance for other users that will join
let remoteUsers = {}

// Method to join stream and connect video and audio feed
let joinAndDisplayLocalStream = async () => {

    client.on('user-published', handleUserJoined)

    client.on('user-left', handleUserLeft)

    // Agora engine automatically assigns extra UID for users
    let UID = await client.join(APP_ID, CHANNEL, TOKEN, null)

    // Tracks for local users
    mic = await AgoraRTC.createMicrophoneAudioTrack()
    camera = await AgoraRTC.createCameraVideoTrack()

    // MediaPipe instantiation for Face Mesh solution
    const faceMesh = new FaceMesh({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.1/${file}`;
    }});

    // Control panel configurations for MediaPipe 
    new ControlPanel(controlsElement, {
        selfieMode: true,
        maxNumFaces: 1,
        minDetectionConfidence: 0.75,
        minTrackingConfidence: 0.75
        })
        .add([
        new StaticText({title: 'MediaPipe Face Mesh'}),
        fpsControl,
        new Toggle({title: 'Selfie Mode', field: 'selfieMode'}),
        new Slider({
            title: 'Max Number of Faces',
            field: 'maxNumFaces',
            range: [1, 4],
            step: 1
        }),
        new Slider({
            title: 'Min Detection Confidence',
            field: 'minDetectionConfidence',
            range: [0, 1],
            step: 0.01
        }),
        new Slider({
            title: 'Min Tracking Confidence',
            field: 'minTrackingConfidence',
            range: [0, 1],
            step: 0.01
        }),
        ])
        .on(options => {
            faceMesh.setOptions(options);
        });

    // Creates the camera object for the video feed of MediaPipe
    const faceMeshCamera = new Camera(video, {
        onFrame: async () => {
            await faceMesh.send({image: video});
        },
        width: 640,
        height: 480,
    });

    // Draws the landmarks on face and starts the camera
    faceMesh.onResults(onResultsFaceMesh);
    faceMeshCamera.start();

    // Used to insert the video stream to the webpage
    let player = `<div class="video-container" id="user-container-${UID}">
                    <div class="video-player" id="user-${UID}"></div>
                  </div>`
    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

    camera.play(`user-${UID}`);

    // Publish both video and audio tracks
    await client.publish([mic, camera]);
}

// Used to join the stream
let joinStream = async () => {
    await joinAndDisplayLocalStream()
    Notification.requestPermission();
    document.getElementById('join-btn').style.display = 'none'
    document.getElementById('stream-controls').style.display = 'flex'
    document.getElementById('selfie-cam').style.display = 'block'
}

// Method for remote users
let handleUserJoined = async (user, mediaType) => {
    // Adds user to list of remote users
    remoteUsers[user.uid] = user
    await client.subscribe(user, mediaType)

    if (mediaType === 'video'){
        let player = document.getElementById(`user-container-${user.uid}`)
        if (player != null){
            player.remove()
        }

        player = `<div class="video-container" id="user-container-${user.uid}">
                        <div class="video-player" id="user-${user.uid}"></div>
                  </div>`
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

        user.videoTrack.play(`user-${user.uid}`)
    }

    if (mediaType === 'audio'){
        user.audioTrack.play()
    }
}

let handleUserLeft = async (user) => {
    // Removes user from list if left stream
    delete remoteUsers[user.uid]
    // Removes the space for the user when leaving stream
    document.getElementById(`user-container-${user.uid}`).remove()
}

let leaveAndRemoveLocalStream = async () => {
    mic.stop()
    mic.close()
    camera.stop()
    camera.close()

    await client.leave()
    document.getElementById('join-btn').style.display = 'block'
    document.getElementById('stream-controls').style.display = 'none'
    document.getElementById('video-streams').innerHTML = ''
    document.getElementById('selfie-cam').style.display = 'none'
}

let toggleMic = async (e) => {
    if (mic.muted){
        await mic.setMuted(false)
        e.target.innerText = 'Mic on'
        e.target.style.backgroundColor = 'cadetblue'
    } else{
        await mic.setMuted(true)
        e.target.innerText = 'Mic off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

let toggleCamera = async (e) => {
    if(camera.muted){
        await camera.setMuted(false)
        e.target.innerText = 'Camera on'
        e.target.style.backgroundColor = 'cadetblue'
    } else{
        await camera.setMuted(true)
        e.target.innerText = 'Camera off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

const threshold = 3;

// Outputs the Face Mesh feed from Camera
function onResultsFaceMesh(results) {
    fpsControl.tick();
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, out.width, out.height);
    canvasCtx.drawImage(results.image, 0, 0, out.width, out.height);
    if (results.multiFaceLandmarks) {
        timer = 0;
        for (const landmarks of results.multiFaceLandmarks) {
        drawConnectors(
            canvasCtx, landmarks, FACEMESH_RIGHT_EYE,
            {color: '#30FF30'});
        drawConnectors(
            canvasCtx, landmarks, FACEMESH_LEFT_EYE,
            {color: '#30FF30'});
        }
    } else {
        if(!timer){
            const currentTime = new Date();
            currentTime.setSeconds(currentTime.getSeconds() + threshold);
            timer = currentTime;
        } else if((new Date).toTimeString() == timer.toTimeString()) {
            new Notification("A student is not paying attention.");
            timer = 0;
        }
    }
    canvasCtx.restore();
}

// Used to create a date-label for the screenshots
var today = new Date()
var dd = today.getDate()
var mm = today.getMonth()+1
var yyyy = today.getFullYear()
if (dd < 10){ dd = '0' + dd } 
if (mm < 10){ mm = '0' + mm }
var hh = today.getHours()
var min = today.getMinutes()
var ss = today.getSeconds()
date = mm+'-'+dd+'-'+yyyy
time = hh+'-'+min+'-'+ss

// Used to capture the video feed and download the screenshot
const srcElement = document.getElementById("video-streams"),
btns = document.querySelectorAll("button");
btns.forEach(btn => { // looping through each btn
    // adding click event to each btn
    btn.addEventListener("click", () => {
        // creating canvas of element using html2canvas
        html2canvas(srcElement).then(canvas => {
        // adding canvas/screenshot to the body
        if(btn.id === "screenshot-btn") {
            const a = document.createElement("a");
            a.href = canvas.toDataURL();
            a.download = date + '-' + time + ".jpg";
            a.click();
        }
        });
    });
});

// Buttons
document.getElementById('join-btn').addEventListener('click', joinStream)
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)