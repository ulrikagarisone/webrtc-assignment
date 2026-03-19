const socket = io.connect('/');
const roomId = Math.random().toString(36).substring(2, 11);

// Planchette movement
let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let currentX = targetX;
let currentY = targetY;
let prevX = currentX;
let prevY = currentY;
const friction = 0.02;

// Peer
let peer;

// Ghost
let ghostImage = null;
let ghostCooldown = false;

// Possession
let possessed = false;
let possessionInterval = null;

// Audio
let audioCtx = null;
let scrapeSource = null;
let scrapeGain = null;

// Letter detection
let currentActiveLetter = null;

// Game
const SPIRIT_WORDS = ['DEATH', 'HAUNTED', 'BEWARE', 'CURSED', 'SHADOW', 'BLOOD', 'WICKED', 'DOOM', 'SPECTER', 'GRAVE'];
const SPIRIT_QUESTIONS = [
    {
        question: 'ARE YOU ALONE?',
        yes: { msg: 'YOU ARE NEVER ALONE', sub: 'i have been here all along... restarting', scary: true },
        no: { msg: 'ARE YOU SURE?', sub: 'the spirits disagree... good bye for now', scary: false }
    },
    {
        question: 'ARE YOU AFRAID?',
        yes: { msg: 'GOOD', sub: 'fear keeps you alive... for now', scary: false },
        no: { msg: 'YOU SHOULD BE', sub: 'the spirits are displeased... restarting', scary: true }
    },
    {
        question: 'DO YOU FEEL SAFE?',
        yes: { msg: 'HOW NAIVE', sub: 'safety is an illusion... restarting', scary: true },
        no: { msg: 'WISE', sub: 'the spirits respect your honesty... good bye', scary: false }
    },
    {
        question: 'IS SOMEONE WATCHING YOU?',
        yes: { msg: 'CORRECT', sub: 'it has been watching you this whole time... good bye', scary: false },
        no: { msg: 'LOOK BEHIND YOU', sub: 'you are not as alone as you think... restarting', scary: true }
    }
];
const MAX_ROUNDS = 3;
let targetWord = '';
let collectedLetters = [];
let gamePhase = 'idle'; // 'watching' | 'spelling' | 'idle' | 'question'
let spiritSpellIndex = 0;
let lastWrongLetter = null;
let spiritSoundSource = null;
let spiritOverlay = null;
let currentRound = 0;
let score = 0;
let currentQuestion = null;

// Helpers 

const getBoardBounds = () => {
    const r = document.querySelector('#board-wrap')?.getBoundingClientRect();
    return {
        minX: r ? r.left + 40 : 100,
        maxX: r ? r.right - 290 : window.innerWidth - 290,
        minY: r ? r.top + 40 : 100,
        maxY: r ? r.bottom - 290 : window.innerHeight - 290
    };
};

const createOverlay = (css) => {
    const el = document.createElement('div');
    el.style.cssText = css;
    document.body.appendChild(el);
    return el;
};

const loadSound = async (url) => {
    try {
        const buffer = await (await fetch(url)).arrayBuffer();
        return audioCtx.decodeAudioData(buffer);
    } catch (e) {
        console.log('loadSound failed for', url, e);
        return null;
    }
};

// Audio 

const initAudio = async () => {
    if (audioCtx) return;
    try {
        audioCtx = new AudioContext();
        const decoded = await loadSound('/assets/wood_scrape.mp3');
        if (!decoded) return;
        scrapeSource = audioCtx.createBufferSource();
        scrapeSource.buffer = decoded;
        scrapeSource.loop = true;
        scrapeGain = audioCtx.createGain();
        scrapeGain.gain.value = 0;
        scrapeSource.connect(scrapeGain);
        scrapeGain.connect(audioCtx.destination);
        scrapeSource.start();
    } catch (e) {
        console.log('initAudio failed', e);
    }
};

const playSpiritSound = async () => {
    if (!audioCtx) return;
    try {
        const decoded = await loadSound('/assets/possesd_sound.mp3');
        if (!decoded) return;
        spiritSoundSource = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();
        spiritSoundSource.buffer = decoded;
        spiritSoundSource.loop = true;
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 1.5);
        spiritSoundSource.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        spiritSoundSource.start();
    } catch (e) {
        console.log('playSpiritSound failed', e);
    }
};

const stopSpiritSound = () => {
    if (spiritSoundSource) {
        spiritSoundSource.stop();
        spiritSoundSource = null;
    }
};

// Possession 

const showPossessionEffect = () => {
    const vignette = createOverlay('position:fixed;inset:0;background:radial-gradient(ellipse at center, transparent 30%, rgba(80,0,0,0.85) 100%);pointer-events:none;z-index:997;opacity:0;transition:opacity 0.8s;');
    setTimeout(() => { vignette.style.opacity = '1'; }, 50);
    const flash = createOverlay('position:fixed;inset:0;background:rgba(140,0,0,0.4);pointer-events:none;z-index:998;transition:opacity 1.2s;');
    setTimeout(() => { flash.style.opacity = '0'; }, 200);
    return { vignette, flash };
};

const shakeBoardTitle = () => {
    const title = document.querySelector('#board-title');
    if (!title) return;
    let shakes = 0;
    const iv = setInterval(() => {
        title.style.transform = `translate(${(Math.random() - 0.5) * 12}px,${(Math.random() - 0.5) * 8}px)`;
        if (++shakes > 10) { clearInterval(iv); title.style.transform = ''; }
    }, 80);
};

const movePossessedPlanchette = (onDone) => {
    let elapsed = 0;
    const { minX, maxX, minY, maxY } = getBoardBounds();
    possessionInterval = setInterval(() => {
        elapsed += 500;
        targetX = minX + Math.random() * (maxX - minX);
        targetY = minY + Math.random() * (maxY - minY);
        if (elapsed >= 6000) { clearInterval(possessionInterval); onDone(); }
    }, 500);
};

const triggerPossession = async () => {
    if (possessed) return;
    possessed = true;
    const { vignette, flash } = showPossessionEffect();
    shakeBoardTitle();
    if (audioCtx) {
        try {
            const decoded = await loadSound('/assets/possesd_sound.mp3');
            if (decoded) {
                const source = audioCtx.createBufferSource();
                const gainNode = audioCtx.createGain();
                source.buffer = decoded;
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.9, audioCtx.currentTime + 0.5);
                gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 6);
                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                source.start();
            }
        } catch (e) {
            console.log('possession sound failed', e);
        }
    }
    movePossessedPlanchette(() => {
        vignette.style.opacity = '0';
        setTimeout(() => { vignette.remove(); flash.remove(); }, 1000);
        possessed = false;
    });
};

// Socket and peer 

socket.on('connect', () => {
    console.log('Desktop connected:', socket.id);
    socket.emit('join', roomId);
    const url = `${window.location.protocol}//${window.location.host}/mobile.html?room=${roomId}`;
    QRCode.toCanvas(document.querySelector('#qr-canvas'), url);
});

document.querySelector('#begin-btn').addEventListener('click', async () => {
    await initAudio();
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
    peer = new SimplePeer({ initiator });

    peer.on('stream', stream => {
        console.log('Stream received!');
        const $video = document.querySelector('#otherCamera');
        $video.srcObject = stream;
        $video.onloadedmetadata = () => {
            $video.play();
            [1500, 3000, 5000].forEach(delay => setTimeout(trySnapshot, delay));
        };
    });

    peer.on('signal', data => { socket.emit('signal', peerId, data); });

    peer.on('connect', () => {
        console.log('CONNECTED!');
        document.querySelector('#qr-canvas').style.display = 'none';
        currentRound = 0;
        score = 0;
        startGame();
    });

    peer.on('data', data => {
        try {
            const motion = JSON.parse(data);
            if (!possessed && gamePhase !== 'watching') {
                targetX += motion.x * 1.6;
                targetY += motion.y * 1.6;
            }
            targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX));
            targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY));
            if (!ghostImage) trySnapshot();
            if (Math.abs(motion.x) + Math.abs(motion.y) > 60) hauntScreen();
        } catch (e) {
            console.log('data parse error', e);
        }
    });

    peer.on('close', () => { peer = null; });
    peer.on('error', (e) => console.log('peer error', e));
};

// Ghost

const ghostSheet = new Image();
ghostSheet.src = '/assets/ghost.png';
ghostSheet.onload = () => console.log('Ghost sheet loaded');

const trySnapshot = () => {
    if (ghostImage) return;
    const $video = document.querySelector('#otherCamera');
    if ($video.srcObject && $video.videoWidth > 0) buildGhostImage($video);
};

const buildGhostImage = ($video) => {
    const W = 300, H = 428;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const ghostReady = ghostSheet.complete && ghostSheet.naturalWidth > 0;
    if (ghostReady) ctx.drawImage(ghostSheet, 0, 0, W, H);
    const faceCX = W * 0.50, faceCY = H * 0.168;
    const faceRX = 52, faceRY = 58;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(faceCX, faceCY, faceRX, faceRY, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = 'grayscale(0.8) contrast(1.1)';
    ctx.drawImage($video, faceCX - faceRX, faceCY - faceRY, faceRX * 2, faceRY * 2);
    ctx.restore();
    if (ghostReady) {
        ctx.globalAlpha = 0.25;
        ctx.drawImage(ghostSheet, 0, 0, W, H);
        ctx.globalAlpha = 1;
    }
    ghostImage = canvas.toDataURL('image/png');
    console.log('Ghost+face composite ready!');
};

const spawnSmoke = ($ghost) => {
    const smoke = document.createElement('div');
    smoke.classList.add('smoke');
    const size = 50 + Math.random() * 70;
    smoke.style.width = size + 'px';
    smoke.style.height = size + 'px';
    smoke.style.left = (parseFloat($ghost.style.left) + 120) + 'px';
    smoke.style.top = (parseFloat($ghost.style.top) + 250) + 'px';
    document.body.appendChild(smoke);
    setTimeout(() => smoke.remove(), 1800);
};

const hauntScreen = () => {
    if (ghostCooldown || !ghostImage) return;
    const $ghost = document.querySelector('#ghost-container');
    const $faceImg = document.querySelector('#ghost-face-img');
    $faceImg.style.backgroundImage = `url(${ghostImage})`;
    const startX = Math.random() > 0.5 ? -320 : window.innerWidth + 50;
    const startY = 60 + Math.random() * (window.innerHeight * 0.5);
    const endX = startX < 0 ? window.innerWidth + 320 : -320;
    $ghost.style.transition = 'none';
    $ghost.style.left = startX + 'px';
    $ghost.style.top = startY + 'px';
    $ghost.style.opacity = '1';
    setTimeout(() => {
        $ghost.style.transition = 'left 3.5s ease-in-out, top 3.5s ease-in-out';
        $ghost.style.left = endX + 'px';
        $ghost.style.top = (startY - 120) + 'px';
    }, 50);
    const smokeInterval = setInterval(() => spawnSmoke($ghost), 160);
    ghostCooldown = true;
    setTimeout(() => {
        $ghost.style.opacity = '0';
        clearInterval(smokeInterval);
        setTimeout(() => { ghostCooldown = false; }, 500);
    }, 3500);
};

// Letter detection 

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

document.querySelectorAll('.yes-no-row span').forEach(span => {
    span.dataset.letter = span.textContent.trim();
    span.classList.add('board-word');
});

const letterElements = [...document.querySelectorAll('.board-letter, .board-word')];
const letterRects = letterElements.map(el => ({ el, r: el.getBoundingClientRect() }));

const checkLetterHover = () => {
    const px = currentX + 125;
    const py = currentY + 40;
    let found = null;
    letterRects.forEach(({ el, r }) => {
        if (px >= r.left - 8 && px <= r.right + 8 && py >= r.top - 8 && py <= r.bottom + 8) {
            found = el.dataset.letter;
        }
    });
    if (found !== currentActiveLetter) {
        letterElements.forEach(el => el.classList.remove('active'));
        if (found) {
            document.querySelector(`[data-letter="${found}"]`).classList.add('active');
            if (peer && peer.connected) {
                peer.send(JSON.stringify({ type: 'letter', value: found }));
                if (found === 'YES' || found === 'NO') {
                    if (gamePhase === 'question') {
                        answerSpiritQuestion(found);
                    } else if (found === 'YES' && !ghostCooldown && ghostImage) {
                        hauntScreen();
                    }
                }
                if (gamePhase === 'spelling') checkGameLetter(found);
            }
            console.log('Letter:', found);
        }
        currentActiveLetter = found;
    }
};

// Game logic

const showPopup = (title, sub = '', duration = 0) => {
    document.querySelector('#popup-title').textContent = title;
    document.querySelector('#popup-sub').textContent = sub;
    document.querySelector('#game-popup').classList.add('visible');
    if (duration > 0) setTimeout(hidePopup, duration);
};

const hidePopup = () => {
    document.querySelector('#game-popup').classList.remove('visible');
};

const renderWordDisplay = () => {
    const display = document.querySelector('#word-display');
    if (!display) return;
    display.innerHTML = targetWord.split('').map((letter, i) => {
        const revealed = collectedLetters[i] !== undefined;
        return `<span class="word-slot ${revealed ? 'revealed' : ''}">${revealed ? collectedLetters[i] : '_'}</span>`;
    }).join('');
};

const endGame = () => {
    gamePhase = 'question';
    currentQuestion = SPIRIT_QUESTIONS[Math.floor(Math.random() * SPIRIT_QUESTIONS.length)];
    showPopup('✦ THE SÉANCE IS COMPLETE ✦', `you communicated ${score} of ${MAX_ROUNDS} words`);
    setTimeout(() => {
        hidePopup();
        setTimeout(() => {
            showPopup('ONE FINAL QUESTION', 'answer with YES or NO on the board');
            setTimeout(() => {
                hidePopup();
                showPopup(currentQuestion.question, 'move the planchette to YES or NO');
            }, 3000);
        }, 1000);
    }, 3000);
};

const answerSpiritQuestion = (answer) => {
    if (gamePhase !== 'question' || !currentQuestion) return;
    gamePhase = 'idle';
    hidePopup();
    const response = answer === 'YES' ? currentQuestion.yes : currentQuestion.no;
    currentQuestion = null;
    setTimeout(() => {
        showPopup(response.msg, response.sub);
        if (response.scary) {
            triggerPossession();
            hauntScreen();
            setTimeout(() => { hidePopup(); currentRound = 0; score = 0; startGame(); }, 8000);
        } else {
            setTimeout(() => {
                hidePopup();
                showPopup('G O O D  B Y E', 'the spirits have departed', 3000);
                setTimeout(() => { currentRound = 0; score = 0; startGame(); }, 4000);
            }, 3000);
        }
    }, 500);
};

const startGame = () => {
    currentRound++;
    if (currentRound > MAX_ROUNDS) { endGame(); return; }
    targetWord = SPIRIT_WORDS[Math.floor(Math.random() * SPIRIT_WORDS.length)];
    collectedLetters = [];
    lastWrongLetter = null;
    gamePhase = 'watching';
    spiritSpellIndex = 0;
    renderWordDisplay();
    showPopup(`ROUND ${currentRound} OF ${MAX_ROUNDS}`, 'the spirits have a message — watch carefully...');
    setTimeout(() => {
        hidePopup();
        spiritOverlay = createOverlay('position:fixed;inset:0;background:rgba(80,0,0,0.25);pointer-events:none;z-index:3;transition:opacity 1s;opacity:0;');
        setTimeout(() => { spiritOverlay.style.opacity = '1'; }, 50);
        playSpiritSound();
        setTimeout(spiritSpellNext, 800);
    }, 3000);
};

const getLetterPosition = (letter) => {
    const el = document.querySelector(`[data-letter="${letter}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - 125, y: r.top + r.height / 2 - 40 };
};

const spiritSpellNext = () => {
    if (spiritSpellIndex >= targetWord.length) {
        setTimeout(() => {
            stopSpiritSound();
            if (spiritOverlay) {
                spiritOverlay.style.opacity = '0';
                setTimeout(() => { spiritOverlay.remove(); spiritOverlay = null; }, 1000);
            }
            collectedLetters = [];
            renderWordDisplay();
            showPopup('NOW IT IS YOUR TURN', 'tilt to spell the same word');
            setTimeout(() => { hidePopup(); gamePhase = 'spelling'; }, 3000);
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
};

const checkGameLetter = (letter) => {
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
            score++;
            showPopup('✦ THE SPIRITS ARE PLEASED ✦', `round ${currentRound} of ${MAX_ROUNDS} complete`, 2500);
            setTimeout(() => { hauntScreen(); setTimeout(startGame, 5000); }, 800);
        }
    } else {
        lastWrongLetter = letter;
        shakeBoard();
    }
};

const shakeBoard = () => {
    const board = document.querySelector('#board-wrap');
    if (!board) return;
    let n = 0;
    const iv = setInterval(() => {
        board.style.transform = `translate(${(Math.random() - 0.5) * 10}px,${(Math.random() - 0.5) * 6}px)`;
        if (++n > 6) { clearInterval(iv); board.style.transform = ''; }
    }, 80);
};

// Animation loop

const init = () => {
    currentX += (targetX - currentX) * friction;
    currentY += (targetY - currentY) * friction;
    const speed = Math.sqrt((currentX - prevX) ** 2 + (currentY - prevY) ** 2);
    prevX = currentX;
    prevY = currentY;
    if (scrapeGain && audioCtx) {
        scrapeGain.gain.setTargetAtTime(Math.min(speed * 0.12, 0.9), audioCtx.currentTime, 0.05);
    }
    const planchette = document.querySelector('#planchette');
    if (planchette) {
        planchette.style.left = `${currentX}px`;
        planchette.style.top = `${currentY}px`;
    }
    checkLetterHover();
    requestAnimationFrame(init);
};
init();