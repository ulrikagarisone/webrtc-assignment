const socket = io.connect('/');
const roomId = Math.random().toString(36).substring(2, 11);

let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let currentX = targetX;
let currentY = targetY;
const friction = 0.02;
let peer;
let ghostImage = null;

// --- Possession Mode ---
let possessed = false;
let possessionInterval = null;

async function triggerPossession() {
    if (possessed) return;
    possessed = true;

    // Dramatic screen effect — vignette closes in
    const vignette = document.createElement('div');
    vignette.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at center, transparent 30%, rgba(80,0,0,0.85) 100%);pointer-events:none;z-index:997;opacity:0;transition:opacity 0.8s;';
    document.body.appendChild(vignette);
    setTimeout(() => { vignette.style.opacity = '1'; }, 50);

    // Red flash on top
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:rgba(140,0,0,0.4);pointer-events:none;z-index:998;transition:opacity 1.2s;';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 200);

    // Shake the board title
    const title = document.querySelector('#board-title');
    if (title) {
        title.style.transition = 'transform 0.1s';
        let shakes = 0;
        const shakeInterval = setInterval(() => {
            title.style.transform = `translate(${(Math.random() - 0.5) * 12}px, ${(Math.random() - 0.5) * 8}px)`;
            if (++shakes > 10) { clearInterval(shakeInterval); title.style.transform = ''; }
        }, 80);
    }

    // Play sound if audio is ready
    if (audioCtx) {
        const response = await fetch('/assets/possesd_sound.mp3');
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();
        source.buffer = decoded;
        source.loop = false;
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.9, audioCtx.currentTime + 0.5);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 6);
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start();
    }

    // Move creepily — stay within the board area
    let elapsed = 0;
    const boardEl = document.querySelector('#board-wrap');
    const boardRect = boardEl ? boardEl.getBoundingClientRect() : null;
    const minX = boardRect ? boardRect.left + 40 : 100;
    const maxX = boardRect ? boardRect.right - 290 : window.innerWidth - 290;
    const minY = boardRect ? boardRect.top + 40 : 100;
    const maxY = boardRect ? boardRect.bottom - 290 : window.innerHeight - 290;

    possessionInterval = setInterval(() => {
        elapsed += 500;
        targetX = minX + Math.random() * (maxX - minX);
        targetY = minY + Math.random() * (maxY - minY);
        if (elapsed >= 6000) {
            clearInterval(possessionInterval);
            // Fade out vignette
            vignette.style.opacity = '0';
            setTimeout(() => { vignette.remove(); flash.remove(); }, 1000);
            possessed = false;
        }
    }, 500);
}

// --- Wood drag sound ---
let audioCtx = null;
let scrapeSource = null;
let scrapeGain = null;

async function initAudio() {
    if (audioCtx) return;
    audioCtx = new AudioContext();
    const response = await fetch('/assets/wood_scrape.mp3');
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    scrapeSource = audioCtx.createBufferSource();
    scrapeSource.buffer = decoded;
    scrapeSource.loop = true;

    scrapeGain = audioCtx.createGain();
    scrapeGain.gain.value = 0;

    scrapeSource.connect(scrapeGain);
    scrapeGain.connect(audioCtx.destination);
    scrapeSource.start();
}

let ghostCooldown = false;

socket.on('connect', () => {
    console.log('Desktop connected:', socket.id);
    socket.emit('join', roomId);
    const url = `${window.location.protocol}//${window.location.host}/mobile.html?room=${roomId}`;
    QRCode.toCanvas(document.querySelector('#qr-canvas'), url);
});

// Start screen — button unlocks audio then fades away
document.querySelector('#begin-btn').addEventListener('click', () => {
    initAudio();
    const screen = document.querySelector('#start-screen');
    screen.style.opacity = '0';
    setTimeout(() => { screen.style.display = 'none'; }, 1000);
});

socket.on('signal', (_myId, signal, peerId) => {
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
        startGame();

    });

    peer.on('data', data => {
        try {
            const motion = JSON.parse(data);
            if (!possessed && gamePhase !== 'watching') {
                targetX += motion.x * 2.5;
                targetY += motion.y * 2.5;
            }
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
    const words = row.textContent.trim().split(/\s+/).filter(w => w.length > 0);
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
// yes-no spans already have data-letter in HTML
document.querySelectorAll('.yes-no-row span').forEach(span => {
    span.dataset.letter = span.textContent.trim();
    span.classList.add('board-word');
});
// arch letter spans already have data-letter in HTML — no processing needed

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
                // Game logic
                if (gamePhase === 'spelling') checkGameLetter(found);
            }
            console.log('Letter:', found);
        }
        currentActiveLetter = found;
    }
}



// ── Game Logic ────────────────────────────────────────────────
const SPIRIT_WORDS = ['DEATH', 'HAUNTED', 'BEWARE', 'CURSED', 'SHADOW', 'BLOOD', 'WICKED', 'DOOM', 'SPECTER', 'GRAVE'];

let targetWord = '';
let collectedLetters = [];
let gamePhase = 'idle'; // 'watching' | 'spelling' | 'idle'
let spiritSpellIndex = 0;
let lastWrongLetter = null;
let spiritSoundSource = null;

function showPopup(title, sub = '', duration = 0) {
    document.querySelector('#popup-title').textContent = title;
    document.querySelector('#popup-sub').textContent = sub;
    document.querySelector('#game-popup').classList.add('visible');
    if (duration > 0) setTimeout(hidePopup, duration);
}

function hidePopup() {
    document.querySelector('#game-popup').classList.remove('visible');
}

function renderWordDisplay() {
    const display = document.querySelector('#word-display');
    if (!display) return;
    display.innerHTML = targetWord.split('').map((letter, i) => {
        const revealed = collectedLetters[i] !== undefined;
        return `<span class="word-slot ${revealed ? 'revealed' : ''}">${revealed ? collectedLetters[i] : '_'}</span>`;
    }).join('');
}

async function playSpiritSound() {
    if (!audioCtx) return;
    const response = await fetch('/assets/possesd_sound.mp3');
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    spiritSoundSource = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    spiritSoundSource.buffer = decoded;
    spiritSoundSource.loop = true;
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 1.5);
    spiritSoundSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    spiritSoundSource.start();
}

function stopSpiritSound() {
    if (spiritSoundSource) {
        spiritSoundSource.stop();
        spiritSoundSource = null;
    }
}

let spiritOverlay = null;

function startGame() {
    targetWord = SPIRIT_WORDS[Math.floor(Math.random() * SPIRIT_WORDS.length)];
    collectedLetters = [];
    lastWrongLetter = null;
    gamePhase = 'watching';
    spiritSpellIndex = 0;
    renderWordDisplay();

    showPopup('THE SPIRITS HAVE A MESSAGE', 'watch carefully...');
    setTimeout(() => {
        hidePopup();
        // Red overlay during spirit spelling
        spiritOverlay = document.createElement('div');
        spiritOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(80,0,0,0.25);pointer-events:none;z-index:3;transition:opacity 1s;opacity:0;';
        document.body.appendChild(spiritOverlay);
        setTimeout(() => { spiritOverlay.style.opacity = '1'; }, 50);
        playSpiritSound();
        setTimeout(spiritSpellNext, 800);
    }, 3000);
}

function getLetterPosition(letter) {
    const el = document.querySelector(`[data-letter="${letter}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - 125, y: r.top + r.height / 2 - 40 };
}

function spiritSpellNext() {
    if (spiritSpellIndex >= targetWord.length) {
        // Done — reset and let player spell
        setTimeout(() => {
            stopSpiritSound();
            // Fade out red overlay
            if (spiritOverlay) {
                spiritOverlay.style.opacity = '0';
                setTimeout(() => { spiritOverlay.remove(); spiritOverlay = null; }, 1000);
            }
            collectedLetters = [];
            renderWordDisplay();
            showPopup('NOW IT IS YOUR TURN', 'tilt to spell the same word');
            setTimeout(() => {
                hidePopup();
                gamePhase = 'spelling';
            }, 3000);
        }, 1000);
        return;
    }
    const letter = targetWord[spiritSpellIndex];
    const pos = getLetterPosition(letter);
    if (pos) { targetX = pos.x; targetY = pos.y; }

    setTimeout(() => {
        collectedLetters.push(letter);
        renderWordDisplay();
        spiritSpellIndex++;
        spiritSpellNext();
    }, 2200);
}

function checkGameLetter(letter) {
    if (gamePhase !== 'spelling') return;
    if (!letter.match(/^[A-Z]$/)) return;
    if (letter === lastWrongLetter) return;

    const nextIndex = collectedLetters.length;
    if (nextIndex >= targetWord.length) return;

    if (letter === targetWord[nextIndex]) {
        lastWrongLetter = null;
        collectedLetters.push(letter);
        renderWordDisplay();
        if (collectedLetters.length === targetWord.length) {
            gamePhase = 'idle';
            showPopup('✦ THE SPIRITS ARE PLEASED ✦', 'you have communicated', 4000);
            setTimeout(() => { hauntScreen(); setTimeout(startGame, 6000); }, 800);
        }
    } else {
        lastWrongLetter = letter;
        shakeBoard();
    }
}

function shakeBoard() {
    const board = document.querySelector('#board-wrap');
    if (!board) return;
    let n = 0;
    const iv = setInterval(() => {
        board.style.transform = `translate(${(Math.random() - 0.5) * 10}px,${(Math.random() - 0.5) * 6}px)`;
        if (++n > 6) { clearInterval(iv); board.style.transform = ''; }
    }, 80);
}

let prevX = currentX;
let prevY = currentY;

function animate() {
    currentX += (targetX - currentX) * friction;
    currentY += (targetY - currentY) * friction;

    // Velocity-linked wood scrape sound
    const vx = currentX - prevX;
    const vy = currentY - prevY;
    const speed = Math.sqrt(vx * vx + vy * vy);
    prevX = currentX;
    prevY = currentY;
    if (scrapeGain && audioCtx) {
        const targetVol = Math.min(speed * 0.12, 0.9);
        scrapeGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.05);
    }
    const planchette = document.querySelector('#planchette');
    if (planchette) {
        planchette.style.left = `${currentX}px`;
        planchette.style.top = `${currentY}px`;
    }
    checkLetterHover();
    requestAnimationFrame(animate);
}
animate();