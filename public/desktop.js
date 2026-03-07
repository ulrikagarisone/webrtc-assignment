const socket = io.connect('/');
const roomId = Math.random().toString(36).substring(2, 11);

let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let currentX = targetX;
let currentY = targetY;
const friction = 0.02;
let peer;
let ghostImage = null;
let ghostCooldown = false;

socket.on('connect', () => {
    console.log('Desktop connected:', socket.id);
    socket.emit('join', roomId);
    const url = `${window.location.protocol}//${window.location.host}/mobile.html?room=${roomId}`;
    QRCode.toCanvas(document.querySelector('#qr-canvas'), url);
});

socket.on('signal', (myId, signal, peerId) => {
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

    peer.on('stream', stream => {
        console.log('Stream received!');
        const $video = document.querySelector('#otherCamera');
        $video.srcObject = stream;
        $video.onloadedmetadata = () => {
            $video.play();
            setTimeout(() => trySnapshot(), 1500);
            setTimeout(() => trySnapshot(), 3000);
            setTimeout(() => trySnapshot(), 5000);
        };
    });

    peer.on('signal', data => { socket.emit('signal', peerId, data); });

    peer.on('connect', () => {
        console.log('CONNECTED!');
        document.querySelector('#qr-canvas').style.display = 'none';
    });

    peer.on('data', data => {
        try {
            const motion = JSON.parse(data);
            targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX + (motion.x * 2.5)));
            targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY + (motion.y * 2.5)));
            const intensity = Math.abs(motion.x) + Math.abs(motion.y);
            if (!ghostImage) trySnapshot();
            if (intensity > 60) hauntScreen();
        } catch (e) { }
    });

    peer.on('close', () => { peer = null; });
    peer.on('error', (e) => console.log('peer error', e));
};

// Pre-load ghost sheet
const ghostSheet = new Image();
ghostSheet.src = '/assets/ghost.png';
ghostSheet.onload = () => console.log(' Ghost sheet loaded');

function trySnapshot() {
    if (ghostImage) return;
    const $video = document.querySelector('#otherCamera');
    if (!$video.srcObject || $video.videoWidth === 0) return;
    buildGhostImage($video);
}


function animate() {
    currentX += (targetX - currentX) * friction;
    currentY += (targetY - currentY) * friction;
    const planchette = document.querySelector('#planchette');
    if (planchette) {
        planchette.style.left = `${currentX}px`;
        planchette.style.top = `${currentY}px`;
    }
    requestAnimationFrame(animate);
}
animate();