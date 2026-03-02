const socket = io();
const roomId = Math.random().toString(36).substring(2, 11);
socket.emit('join', roomId);

let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let currentX = targetX;
let currentY = targetY;
const friction = 0.02;

// Generate QR Code for the phone to scan
const url = `${window.location.protocol}//${window.location.host}/mobile.html?room=${roomId}`;
QRCode.toCanvas(document.getElementById('qr-canvas'), url);

// Motion data is relayed through the socket.io server — no WebRTC/TURN needed.
// This works on any network (school, corporate) since the phone and desktop
// are both already connected to this server.
socket.on('peer-joined', () => {
    console.log("Spirit detected! Connection ready via server relay.");
});

socket.on('motion', (data) => {
    targetX += data.x * 2.5;
    targetY += data.y * 2.5;
    targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX));
    targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY));
});

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