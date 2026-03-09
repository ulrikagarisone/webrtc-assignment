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

    socket.on('peer-joined', (phoneId) => {
        console.log('Desktop id received:', phoneId);
        desktopId = phoneId;
        // only create peer if button already clicked and camera ready
        if (buttonClicked) createPeer(true, desktopId);
    });

    socket.on('signal', (myId, signal, peerId) => {
        if (peer) { peer.signal(signal); }
    });

    const createPeer = (initiator, peerId) => {
        console.log('Creating peer, stream:', myStream ? 'YES' : 'NO');
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
        peer.on('data', data => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'letter') {
                    if (navigator.vibrate) navigator.vibrate(120);
                    const display = document.querySelector('#letter-display');
                    if (display) {
                        display.textContent = msg.value;
                        display.classList.remove('pop');
                        void display.offsetWidth;
                        display.classList.add('pop');
                    }
                    // full screen flash for iOS (no vibration support)
                    const flash = document.createElement('div');
                    flash.style.cssText = 'position:fixed;inset:0;background:rgba(212,175,55,0.18);pointer-events:none;z-index:9999;animation:flashFade 0.35s ease-out forwards;';
                    document.body.appendChild(flash);
                    setTimeout(() => flash.remove(), 350);
                }
            } catch (e) { }
        });
        peer.on('close', () => { peer = null; });
        peer.on('error', (e) => console.log('error', e));
    };

    document.querySelector('#start').addEventListener('click', async () => {
        document.querySelector('#start').style.display = 'none';

        // Get camera FIRST before anything else
        try {
            myStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            console.log('Camera ready!');
        } catch (err) {
            console.log('Camera denied:', err.message);
            myStream = null;
        }

        buttonClicked = true;

        // Now create peer with stream attached
        if (desktopId) createPeer(true, desktopId);

        // Request motion permission (iOS)
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') { showPlanchetteUI(); startMoving(); }
                    else { alert('Permission denied!'); }
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
            if (img) img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
            if (peer && peer.connected) {
                peer.send(JSON.stringify({ x: event.gamma, y: event.beta }));
            }
        });
    }
}