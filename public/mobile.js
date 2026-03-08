const socket = io.connect('/');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
let peer;
let desktopId = null;
let myStream = null;
let buttonClicked = false;

if (roomId) {
    socket.on('connect', () => {
        console.log('Mobile connected:', socket.id);
        socket.emit('join', roomId);
    });

    socket.on('peer-joined', (id) => {
        console.log('Desktop id received:', id);
        desktopId = id;
        if (buttonClicked) {
            createPeer(true, desktopId);
        }
    });

    socket.on('signal', (myId, signal, peerId) => {
        if (peer) { peer.signal(signal); }
    });

    const createPeer = (initiator, peerId) => {
        console.log('Creating peer — stream tracks:', myStream ? myStream.getTracks().length : 'NO STREAM');
        peer = new SimplePeer({
            initiator,
            stream: myStream || undefined,
            trickle: true,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });
        peer.on('signal', data => { socket.emit('signal', peerId, data); });
        peer.on('connect', () => {
            console.log('CONNECTED!');
            if (navigator.vibrate) navigator.vibrate(200);
        });
        peer.on('close', () => { peer = null; });
        peer.on('error', (e) => console.log('peer error', e));
    };

    document.querySelector('#start').addEventListener('click', async () => {
        document.querySelector('#start').style.display = 'none';

        try {
            myStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            console.log('Camera ready! Tracks:', myStream.getTracks().length);
        } catch (err) {
            console.log('Camera denied:', err.message);
            myStream = null;
        }

        buttonClicked = true;

        if (desktopId) {
            createPeer(true, desktopId);
        }

        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') { showPlanchetteUI(); startMoving(); }
                    else { alert('Motion permission denied!'); }
                }).catch(console.error);
        } else {
            showPlanchetteUI();
            startMoving();
        }
    });

    function showPlanchetteUI() {
        document.querySelector('#intro-ui').style.display = 'none';
        const ui = document.querySelector('#planchette-ui');
        ui.style.display = 'flex';
        setTimeout(() => { ui.style.opacity = '1'; }, 10);
    }

    function startMoving() {
        window.addEventListener('deviceorientation', (event) => {
            const img = document.querySelector('#planchette-img');
            if (img) {
                img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
            }
            if (peer && peer.connected) {
                peer.send(JSON.stringify({ x: event.gamma, y: event.beta }));
            }
        });
    }
}