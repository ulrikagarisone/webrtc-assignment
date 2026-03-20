const socket = io.connect('/');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

// Connection
let peer;
let desktopId = null;

// Camera / stream
let myStream = null;
let buttonClicked = false;

// Creates a full-screen flash overlay — used for letter feedback and photo capture
const createFlash = (color, duration) => {
    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;inset:0;background:${color};pointer-events:none;z-index:9999;transition:opacity ${duration}ms;`;
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), duration); }, 50);
};

if (roomId) {
    socket.on('connect', () => {
        console.log('Mobile connected:', socket.id);
        socket.emit('join', roomId);
    });

    socket.on('peer-joined', (phoneId) => {
        console.log('Desktop id received:', phoneId);
        desktopId = phoneId;
        if (buttonClicked) createPeer(true, desktopId);
    });

    socket.on('signal', (_myId, signal, _peerId) => {
        if (peer) peer.signal(signal);
    });

    // whichever arrives last (camera or desktop id) triggers the peer connection
    // buttonClicked flag ensures stream is ready before creating peer
    const createPeer = (initiator, peerId) => {
        console.log('Creating peer, stream:', myStream ? 'YES' : 'NO');
        peer = new SimplePeer({
            initiator,
            stream: myStream || undefined,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });
        peer.on('signal', data => { socket.emit('signal', peerId, data); });
        peer.on('connect', () => { console.log('CONNECTED!'); });
        peer.on('data', data => {
            try {
                const msg = JSON.parse(data);
                if (msg.type !== 'letter') return;
                const display = document.querySelector('#letter-display');
                if (!display) return;
                display.textContent = msg.value;
                display.classList.remove('pop');
                void display.offsetWidth;
                display.classList.add('pop');
                createFlash('rgba(212,175,55,0.18)', 350);
            } catch (e) {
                console.log('data error', e);
            }
        });
        peer.on('close', () => { peer = null; });
        peer.on('error', (e) => console.log('peer error', e));
    };

    const requestMotionPermission = async () => {
        if (typeof DeviceOrientationEvent === 'undefined') return true;
        if (typeof DeviceOrientationEvent.requestPermission !== 'function') return true;
        try {
            const state = await DeviceOrientationEvent.requestPermission();
            return state === 'granted';
        } catch (e) {
            console.log('motion permission error', e);
            return false;
        }
    };

    const requestCamera = async () => {
        try {
            myStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            console.log('Camera ready!');
            return true;
        } catch (err) {
            console.log('Camera denied:', err.message);
            myStream = null;
            return false;
        }
    };

    document.querySelector('#start').addEventListener('click', async () => {
        document.querySelector('#start').style.display = 'none';

        // Motion permission first. iOS loses gesture context after any await
        const motionGranted = await requestMotionPermission();
        if (!motionGranted) {
            alert('Motion permission is required to play.');
            document.querySelector('#start').style.display = 'block';
            return;
        }

        const cameraGranted = await requestCamera();
        if (cameraGranted) {
            showFaceCaptureUI();
        } else {
            // Camera denied — skip face capture and go straight to planchette
            buttonClicked = true;
            if (desktopId) createPeer(true, desktopId);
            showPlanchetteUI();
            startMoving();
        }
    });

    const showFaceCaptureUI = () => {
        document.querySelector('#intro-ui').style.display = 'none';
        const faceUI = document.querySelector('#face-capture-ui');
        faceUI.style.display = 'flex';
        document.querySelector('#face-preview').srcObject = myStream;
    };

    document.querySelector('#capture-btn').addEventListener('click', () => {
        document.querySelector('#face-preview').srcObject = null;
        createFlash('white', 400);
        buttonClicked = true;
        if (desktopId) createPeer(true, desktopId);
        setTimeout(() => {
            document.querySelector('#face-capture-ui').style.display = 'none';
            showPlanchetteUI();
            startMoving();
        }, 300);
    });

    const showPlanchetteUI = () => {
        const ui = document.querySelector('#planchette-ui');
        ui.style.display = 'flex';
        setTimeout(() => { ui.style.opacity = '1'; }, 10);
    };

    const startMoving = () => {
        const img = document.querySelector('#planchette-img');
        window.addEventListener('deviceorientation', (event) => {
            if (img) img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
            if (peer && peer.connected) {
                peer.send(JSON.stringify({ x: event.gamma, y: event.beta }));
            }
        });
    };
}