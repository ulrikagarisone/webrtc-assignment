const socket = io();
const roomId = Math.random().toString(36).substring(2, 11);
socket.emit('join', roomId);

let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let currentX = targetX;
let currentY = targetY;
const friction = 0.02; //make it feel heavy

const url = `${window.location.protocol}//${window.location.host}/mobile.html?room=${roomId}`;
QRCode.toCanvas(document.getElementById('qr-canvas'), url);

const peer = new SimplePeer({
    initiator: false,
    trickle: false,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
});

peer.on('signal', signal => {
    socket.emit('signal', { roomId, signal });
});

socket.on('signal', data => {
    peer.signal(data.signal);
});

peer.on('data', data => {
    try {
        const motion = JSON.parse(data);
        console.log("Spirit Data Received:", motion);

        targetX += motion.x * 2;
        targetY += motion.y * 2;

        // BOUNDARIES subtract 80 because that is the width planchette
        targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX));
        targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY));

    } catch (e) {
        console.log('Spiritual Message:', data.toString());
    }
});

function animate() {
    // smoooooth movement math
    currentX += (targetX - currentX) * friction;
    currentY += (targetY - currentY) * friction;

    const planchette = document.getElementById('planchette');
    if (planchette) {
        // update the position
        planchette.style.left = `${currentX}px`;
        planchette.style.top = `${currentY}px`;
    }
    requestAnimationFrame(animate);
}
animate();

