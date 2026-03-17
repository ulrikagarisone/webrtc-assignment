const socket = io.connect('/');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
let peer;
let desktopId = null;
let myStream = null;
let buttonClicked = false;

// Creates a full-screen flash overlay
const createFlash = (color, duration) => {
    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;inset:0;background:${color};pointer-events:none;z-index:9999;transition:opacity ${duration}ms;`;
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), duration); }, 50);
}

if (roomId) {
    socket.on('connect', () => {
        console.log('Mobile connected:', socket.id);
        socket.emit('join', roomId);
    });

    socket.on('peer-joined', (phoneId) => {
        console.log('Desktop id received:', phoneId);
        desktopId = phoneId;
        // only create peer if button already clicked and camera ready
        if (buttonClicked) createPeer(true, desktopId);
    });

    socket.on('signal', (_myId, signal, _peerId) => {
        if (peer) peer.signal(signal);
    });

    const createPeer = (initiator, peerId) => {
        console.log('Creating peer, stream:', myStream ? 'YES' : 'NO');
        peer = new SimplePeer({
            initiator,
            stream: myStream || undefined
        });
        peer.on('signal', data => { socket.emit('signal', peerId, data); });
        peer.on('connect', () => {
            console.log('CONNECTED!');
        });
        peer.on('data', data => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'letter') {
                    const display = document.querySelector('#letter-display');
                    if (display) {
                        display.textContent = msg.value;
                        display.classList.remove('pop');
                        void display.offsetWidth;
                        display.classList.add('pop');
                    }
                    // full screen gold flash for iOS (no vibration support)
                    createFlash('rgba(212,175,55,0.18)', 350);
                }
            } catch (e) { }
        });
        peer.on('close', () => { peer = null; });
        peer.on('error', (e) => console.log('error', e));
    };

    document.querySelector('#start').addEventListener('click', async () => {
        document.querySelector('#start').style.display = 'none';

        // Motion permission MUST be first — iOS loses gesture context after any await
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const state = await DeviceOrientationEvent.requestPermission();
                if (state !== 'granted') { alert('Motion permission denied!'); return; }
            } catch (e) { console.log('motion permission error', e); }
        }

        // Get camera and show face capture screen
        try {
            myStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            console.log('Camera ready!');
            showFaceCaptureUI();
        } catch (err) {
            console.log('Camera denied:', err.message);
            myStream = null;
            // skip face capture if no camera
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

        // Show live preview
        const preview = document.querySelector('#face-preview');
        preview.srcObject = myStream;
    }

    document.querySelector('#capture-btn').addEventListener('click', () => {
        // Stop the preview — reuse same stream for peer, no second permission popup
        const preview = document.querySelector('#face-preview');
        preview.srcObject = null;

        // White camera flash effect
        createFlash('white', 400);

        // Connect peer and go to planchette
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
    }

    const startMoving = () => {
        const img = document.querySelector('#planchette-img');
        window.addEventListener('deviceorientation', (event) => {
            if (img) img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
            if (peer && peer.connected) {
                peer.send(JSON.stringify({ x: event.gamma, y: event.beta }));
            }
        });
    }
}