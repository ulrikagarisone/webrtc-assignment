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
        initiator
    });

    peer.on('stream', stream => {
        console.log('Stream received!');
        const $video = document.querySelector('#otherCamera');
        $video.srcObject = stream;
        $video.onloadedmetadata = () => {
            $video.play();
            // Try snapshot a few times to make sure video is ready
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
            targetX += motion.x * 2.5;
            targetY += motion.y * 2.5;
            targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX));
            targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY));

            const intensity = Math.abs(motion.x) + Math.abs(motion.y);
            if (!ghostImage) trySnapshot();
            if (intensity > 60) hauntScreen();
        } catch (e) { }
    });

    peer.on('close', () => { peer = null; });
    peer.on('error', (e) => console.log('peer error', e));
};

// Pre-load ghost sheet image from assets
const ghostSheet = new Image();
ghostSheet.src = '/assets/ghost.png';
ghostSheet.onload = () => console.log('Ghost sheet loaded');

function trySnapshot() {
    if (ghostImage) return;
    const $video = document.querySelector('#otherCamera');
    if (!$video.srcObject || $video.videoWidth === 0) return;
    buildGhostImage($video);
}

function buildGhostImage($video) {
    const W = 300, H = 428;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Draw ghost sheet as base
    if (ghostSheet.complete && ghostSheet.naturalWidth > 0) {
        ctx.drawImage(ghostSheet, 0, 0, W, H);
    }

    // Clip face into the oval hole on the ghost
    const faceCX = W * 0.50;
    const faceCY = H * 0.168;
    const faceRX = 52;
    const faceRY = 58;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(faceCX, faceCY, faceRX, faceRY, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = 'grayscale(0.8) brightness(1.0) contrast(1.1)';
    const drawSize = faceRX * 2;
    ctx.drawImage($video, faceCX - drawSize / 2, faceCY - drawSize / 2, drawSize, drawSize);
    ctx.restore();

    // Ghost sheet again at low opacity on top for veil effect
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

// ── Letter detection ──────────────────────────────────────────
let currentActiveLetter = null;

// inject glow style
const glowStyle = document.createElement('style');
glowStyle.textContent = `
    .board-letter, .board-word {
        display: inline-block;
        transition: opacity 0.12s, text-shadow 0.12s, transform 0.12s;
    }
    .board-letter.active, .board-word.active {
        opacity: 1 !important;
        color: #fff8dc;
        text-shadow: 0 0 10px rgba(255,220,100,0.9), 0 0 28px rgba(255,180,0,0.6);
        transform: scale(1.3);
    }
`;
document.head.appendChild(glowStyle);

// give every letter/word a data-letter attribute for detection
document.querySelectorAll('.board-content p').forEach(row => {
    const text = row.textContent.trim();
    // replace each row's text with individual spans
    const words = text.split(/\s+/).filter(w => w.length > 0);
    row.innerHTML = '';
    words.forEach(word => {
        const span = document.createElement('span');
        span.textContent = word;
        span.dataset.letter = word;
        span.className = word.length === 1 ? 'board-letter' : 'board-word';
        span.style.margin = '0 8px';
        row.appendChild(span);
    });
});

function checkLetterHover() {
    const px = currentX + 125; // horizontal center of planchette
    const py = currentY + 40;  // near top hole of planchette image
    let found = null;

    document.querySelectorAll('.board-letter, .board-word').forEach(el => {
        const r = el.getBoundingClientRect();
        if (px >= r.left - 8 && px <= r.right + 8 &&
            py >= r.top - 8 && py <= r.bottom + 8) {
            found = el.dataset.letter;
        }
    });

    if (found !== currentActiveLetter) {
        document.querySelectorAll('.board-letter, .board-word').forEach(el => el.classList.remove('active'));
        if (found) {
            document.querySelector(`[data-letter="${found}"]`).classList.add('active');
            if (peer && peer.connected) {
                peer.send(JSON.stringify({ type: 'letter', value: found }));
            }
            console.log('Letter:', found);
        }
        currentActiveLetter = found;
    }
}

function animate() {
    currentX += (targetX - currentX) * friction;
    currentY += (targetY - currentY) * friction;
    const planchette = document.querySelector('#planchette');
    if (planchette) {
        planchette.style.left = `${currentX}px`;
        planchette.style.top = `${currentY}px`;
    }
    checkLetterHover();
    requestAnimationFrame(animate);
}
animate();