const socket = io.connect('/');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
let peer;
let desktopId = null;

if (roomId) {
    socket.on('connect', () => {
        console.log('Mobile connected:', socket.id);
        socket.emit('join', roomId);
    });

    // server tells mobile the desktop's socket.id
    socket.on('peer-joined', (phoneId) => {
        console.log('Desktop id received:', phoneId);
        desktopId = phoneId;
        createPeer(true, desktopId);
    });

    socket.on('signal', (myId, signal, peerId) => {
        console.log('Mobile received signal from', peerId);
        if (peer) {
            peer.signal(signal);
        }
    });

    const createPeer = (initiator, peerId) => {
        peer = new SimplePeer({
            initiator,
            trickle: true,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        peer.on('signal', data => {
            socket.emit('signal', peerId, data); // now sending to desktop socket.id!
        });

        peer.on('connect', () => {
            console.log('CONNECTED!');
            if (navigator.vibrate) navigator.vibrate(200);
        });

        peer.on('close', () => { peer = null; });
        peer.on('error', () => console.log('error'));
    };

    const startBtn = document.getElementById('start');
    startBtn.addEventListener('click', () => {
        startBtn.style.display = 'none';

        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') {
                        showPlanchetteUI();
                        startMoving();
                    } else {
                        alert('Permission denied!');
                    }
                }).catch(console.error);
        } else {
            showPlanchetteUI();
            startMoving();
        }
    });

    function showPlanchetteUI() {
        document.getElementById('intro-ui').style.display = 'none';
        const planchetteUI = document.getElementById('planchette-ui');
        planchetteUI.style.display = 'flex';
        setTimeout(() => { planchetteUI.style.opacity = '1'; }, 10);
    }

    function startMoving() {
        window.addEventListener('deviceorientation', (event) => {
            const img = document.getElementById('planchette-img');
            if (img) {
                img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
            }
            if (peer && peer.connected) {
                peer.send(JSON.stringify({ x: event.gamma, y: event.beta }));
            }
        });
    }
}