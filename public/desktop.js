const socket = io.connect('/');
const roomId = Math.random().toString(36).substring(2, 11);

let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let currentX = targetX;
let currentY = targetY;
const friction = 0.02;
let peer;

socket.on('connect', () => {
    console.log('Desktop connected:', socket.id);
    socket.emit('join', roomId);
    const url = `${window.location.protocol}//${window.location.host}/mobile.html?room=${roomId}`;
    QRCode.toCanvas(document.getElementById('qr-canvas'), url);
});

// exactly like teacher's receiver.html — wait for signal, not peer-joined
socket.on('signal', (myId, signal, peerId) => {
    console.log('Desktop received signal from', peerId);
    if (peer) {
        peer.signal(signal);
    } else if (signal.type === 'offer') {
        createPeer(false, peerId);
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
        socket.emit('signal', peerId, data);
    });

    peer.on('connect', () => {
        console.log('CONNECTED!');
        document.getElementById('qr-canvas').style.display = 'none';
    });

    peer.on('data', data => {
        try {
            const motion = JSON.parse(data);
            targetX += motion.x * 2.5;
            targetY += motion.y * 2.5;
            targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX));
            targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY));
        } catch (e) { }
    });

    peer.on('close', () => {
        console.log('closed');
        peer = null;
    });

    peer.on('error', () => {
        console.log('error');
    });
};

function animate() {
    currentX += (targetX - currentX) * friction;
    currentY += (targetY - currentY) * friction;
    const planchette = document.getElementById('planchette');
    if (planchette) {
        planchette.style.left = `${currentX}px`;
        planchette.style.top = `${currentY}px`;
    }
    requestAnimationFrame(animate);
}
animate();