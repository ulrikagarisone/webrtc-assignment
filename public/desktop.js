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

function buildGhostImage($video) {
    // Ghost image is 1399x2000, face hole center 300x428
    const W = 300, H = 428;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ghost sheet at full opacity as base
    if (ghostSheet.complete && ghostSheet.naturalWidth > 0) {
        ctx.drawImage(ghostSheet, 0, 0, W, H);
    }

    //  face ON TOP, clipped to oval, centered on the face hole
    const faceCX = W * 0.50;   // center x of face hole
    const faceCY = H * 0.168;  // center y of face hole
    const faceRX = 52;         // oval half-width
    const faceRY = 58;         // oval half-height

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(faceCX, faceCY, faceRX, faceRY, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.filter = 'grayscale(0.8) brightness(1.0) contrast(1.1)';

    // Draw camera frame centered on the face oval
    const drawSize = faceRX * 2; 
    ctx.drawImage(
        $video,
        faceCX - drawSize / 2,
        faceCY - drawSize / 2,
        drawSize,
        drawSize
    );
    ctx.restore();

    //ghost sheet again at low opacity on top — gives a "through the sheet" veil effect
    ctx.globalAlpha = 0.25;
    if (ghostSheet.complete && ghostSheet.naturalWidth > 0) {
        ctx.drawImage(ghostSheet, 0, 0, W, H);
    }
    ctx.globalAlpha = 1;

    ghostImage = canvas.toDataURL('image/png');
    console.log('Ghost+face composite ready!');
}

function hauntScreen() {
    if (ghostCooldown || !ghostImage) return;

    const $ghost = document.querySelector('#ghost-container');
    const $faceImg = document.querySelector('#ghost-face-img');

    $faceImg.style.backgroundImage = `url(${ghostImage})`;

    const startX = Math.random() > 0.5 ? -320 : window.innerWidth + 50;
    const startY = 60 + Math.random() * (window.innerHeight * 0.5);
    const endX = startX < 0 ? window.innerWidth + 320 : -320;
    const endY = startY - 120;

    $ghost.style.transition = 'none';
    $ghost.style.left = startX + 'px';
    $ghost.style.top = startY + 'px';
    $ghost.style.opacity = '1';

    setTimeout(() => {
        $ghost.style.transition = 'left 3.5s ease-in-out, top 3.5s ease-in-out';
        $ghost.style.left = endX + 'px';
        $ghost.style.top = endY + 'px';
    }, 50);

    const smokeInterval = setInterval(() => {
        const smoke = document.createElement('div');
        smoke.classList.add('smoke');
        const size = 50 + Math.random() * 70;
        smoke.style.width = size + 'px';
        smoke.style.height = size + 'px';
        smoke.style.left = (parseFloat($ghost.style.left) + 120) + 'px';
        smoke.style.top = (parseFloat($ghost.style.top) + 250) + 'px';
        document.body.appendChild(smoke);
        setTimeout(() => smoke.remove(), 1800);
    }, 160);

    ghostCooldown = true;

    setTimeout(() => {
        $ghost.style.opacity = '0';
        clearInterval(smokeInterval);
        setTimeout(() => { ghostCooldown = false; }, 500);
    }, 3500);
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