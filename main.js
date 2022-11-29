const APP_ID = "0814c9b1c6bb4a7aae18007e82a33091"
const TOKEN = "007eJxTYHg/KWLRBHX5JJXCrtSYqRcdn0l7/Yw+VNMR98pAc2luvY0Cg4GFoUmyZZJhsllSkkmieWJiqqGFgYF5qoVRorGxgaXhkprW5IZARobcRiNGRgYIBPG5GHIyy1KLS4pSE3MZGADWdSDh"
const CHANNEL = "livestream"

const controlsElement = document.getElementsByClassName('control')[0];
const video = document.getElementsByClassName('input_video')[0];
const out = document.getElementsByClassName('output')[0];
const canvasCtx = out.getContext('2d');

const fpsControl = new FPS();

const client = AgoraRTC.createClient({mode:'rtc', 'codec':"vp8"})

let mic, camera;

let remoteUsers = {}

let joinAndDisplayLocalStream = async () => {

    client.on('user-published', handleUserJoined)

    client.on('user-left', handleUserLeft)

    let UID = await client.join(APP_ID, CHANNEL, TOKEN, null)

    mic = await AgoraRTC.createMicrophoneAudioTrack()
    camera = await AgoraRTC.createCameraVideoTrack()

    const faceMesh = new FaceMesh({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.1/${file}`;
    }});

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

    const faceMeshCamera = new Camera(video, {
        onFrame: async () => {
            await faceMesh.send({image: video});
        },
        width: 640,
        height: 480,
    });

    faceMesh.onResults(onResultsFaceMesh);
    faceMeshCamera.start();

    faceMesh.onResults(onResultsFaceMesh);
    let player = `<div class="video-container" id="user-container-${UID}">
                    <div class="video-player" id="user-${UID}"></div>
                  </div>`
    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

    camera.play(`user-${UID}`);

    await client.publish([mic, camera]);
}

let joinStream = async () => {
    await joinAndDisplayLocalStream()
    document.getElementById('join-btn').style.display = 'none'
    document.getElementById('stream-controls').style.display = 'flex'
}

let handleUserJoined = async (user, mediaType) => {
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
    delete remoteUsers[user.uid]
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

function onResultsFaceMesh(results) {
    fpsControl.tick();
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, out.width, out.height);
    canvasCtx.drawImage(
        results.image, 0, 0, out.width, out.height);
    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
        drawConnectors(
            canvasCtx, landmarks, FACEMESH_RIGHT_EYE,
            {color: '#30FF30'});
        drawConnectors(
            canvasCtx, landmarks, FACEMESH_LEFT_EYE,
            {color: '#30FF30'});
        }
    }
    canvasCtx.restore();
}

document.getElementById('join-btn').addEventListener('click', joinStream)
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)