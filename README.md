# WebRTC Assignment: The Ouija Experience 

## Project Overview Idea
This project is a one-to-one interactive experience where a smartphone (mobile) acts as a planchette to control a desktop Ouija board. It utilizes WebSockets for signaling and WebRTC Data Channels for real-time sensor-based control.

## Development Diary

### Feb 17, 2026: Project initialization
* **Setup**: Created the repository.
* **Architecture**: Established a Node.js server with Express and Socket.io. 
* **Structure**: Organized the `/public` directory with dedicated files for `desktop` (receiver) and `mobile` (controller).
* **Installed** qrcode library to handle the one-to-one connection requirement. Verified that package.json includes all necessary dependencies for a clean npm install by the instructors.
* **AI Reflection**: 
    * **Use**: Consulted AI to help me with the "Ouija Board" concept to maximize bonus points for sensors and video.
    * **Modifications**: AI suggested a complex 3D setup, but I refactored the plan to a 2D approach to stay within my current technical comfort level and ensure stability.
    * **Git**: Used AI to troubleshoot a `refs/heads/main` error during the first push.

### Feb 21, 2026: Project setup
##  Phase 1: Environment & workflow setup
* **Branching Strategy**: Following **GitHub Flow**, I moved development from `main` to a `feature/setup` branch.
* **Dependencies**: Initialized `package.json` and installed the "Team" of libraries: `express`, `socket.io`, and `qrcode`.
* **AI Reflection**: I used AI to verify my `package.json` structure and to learn the Git commands needed to move my initial work into a feature branch without losing progress.

## Phase 2: The "ghost host" (signaling server)
* **Goal**: Create a relay station so the two devices can find each other.
* **Implementation**: Built `server.js` using `socket.io`. 
    * Used `socket.on('join')` to create private rooms based on a unique ID.
    * Set up a `signal` relay to pass WebRTC handshake data.
* **Best Practices**: Mirrored the signaling patterns found in the `creative-code-4-s26` repository.

## Phase 3: The board (desktop implementation)
* **Goal**: Generate a "Secret Handshake" (QR Code) for the phone.
* **Step-by-Step Development**:
    1. **Room ID**: Created a unique string using `Math.random().toString(36).substring(2, 11)`.
    2. **QR Generation**: Used the `QRCode` library to turn the mobile URL into a scanable canvas element.
    3. **WebRTC Setup**: Initialized `SimplePeer` as a receiver (`initiator: false`).
* **AI Reflection**: AI helped me fix a "deprecated" warning by suggesting I switch from `.substr()` to `.substring()`. I also used AI to understand how to target the HTML `<canvas>` correctly for the QR code display.

## Phase 4: The tablet (mobile implementation)
* **Goal**: Allow the phone to join the room and start the connection.
* **Implementation**:
    1. **URL Parsing**: Used `URLSearchParams` to grab the `room` ID automatically after the QR scan.
    2. **WebRTC Setup**: Initialized `SimplePeer` as the **Initiator** (`initiator: true`) to "call" the desktop.
* **AI Reflection**: I used AI to ensure the mobile device was set as the initiator, matching the logic taught in class for mobile-to-desktop pairing.

### AI collaboration log:

* **Problem 1 (The syntax)**: My code used `.substr()`, but VS Code and my phone console warned me it was deprecated.
    * **AI Help**: Gemini explained that `.substr()` is an old "legacy" feature.
    * **The Fix**: I changed it to `.substring(2, 11)` to make the Room ID logic modern and stable for all browsers.


**The Problem**: My project worked perfectly on my Mac, but when I scanned the QR code with my iPhone, I got a "Server Not Found" error. I had to troubleshoot the network path between the two devices.

#### Step 1: The "localhost" mistake
* **Discovery**: I was initially using `http://localhost:3000`.
* **AI Explanation**: Gemini explained that `localhost` is a "loopback" address that refers only to "this specific device." When scanned, my iPhone was looking for the server on itself instead of finding my Mac.

#### Step 2: The ".local" hostname attempt
* **Action**: Based on initial AI advice, I tried using my Mac's local hostname: 
    `const url = 'http://Ulrikas-MacBook-Pro.local:3000/...'`
* **Result**: This worked occasionally, but proved unreliable. I learned that hostnames like `.local` depend on specific router configurations and "mDNS" support, which isn't always stable on every Wi-Fi network.

#### Step 3: The olution (Dynamic IP)
* **The Final Fix**: I realized that "hardcoding" any specific name (like `Ulrikas-MacBook-Pro`) or number (like an IP) directly into the code makes the project fragile.
* **Implementation**:
    1.  **Dynamic URLs**: I refactored the QR code logic to use `window.location.origin`. This allows the URL to adapt automatically to whatever address I use to open the site on my Mac.
    2.  **Network Access**: I learned to find my computer's **Actual IP Address** (e.g., `192.168.1.XX`) to host the session.
    3.  **Server Cleanup**: I updated `server.js` to a generic `server.listen(PORT)` so the backend is not tied to a specific machine name.

---
# Code evolution: from AI concept to final project

## 1. server.js

### ❌ Initial AI Draft

The server originally used a hardcoded Apple hostname, which I realized would break if I changed networks or used a different computer.

```javascript
server.listen(PORT, () => console.log(`Go to: http://Ulrikas-MacBook-Pro.local:${PORT}/desktop.html`));
```

### ✅ Refactored Final

I modernized the listener to be generic. I also implemented the room-joining and signaling relay logic required to bridge the two devices.

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    // Join event for private room pairing
    socket.on('join', (roomId) => {
        socket.join(roomId);
    });

    // WebRTC signaling relay (The "Ghost Host")
    socket.on('signal', (data) => {
        socket.to(data.roomId).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

---

## 2. desktop.js 

### ❌ Initial AI Draft

The initial code for the unique Room ID used an older method (`.substr`), and the URL for the QR code was static.

```javascript
const roomId = Math.random().toString(36).substr(2, 9);
```

### ✅ Refactored Final

I updated the code to use modern `.substring()` and implemented `window.location.origin`. This ensures the QR code works dynamically on any network.

```javascript
const socket = io();
const roomId = Math.random().toString(36).substring(2, 11);

socket.emit('join', roomId);

// Dynamic URL generation for QR Code
const url = `${window.location.origin}/mobile.html?room=${roomId}`;
QRCode.toCanvas(document.getElementById('qr-canvas'), url);

// SimplePeer initialization as Receiver (initiator: false)
const peer = new SimplePeer({ initiator: false, trickle: false });

peer.on('signal', signal => {
    socket.emit('signal', { roomId, signal });
});

socket.on('signal', data => {
    peer.signal(data.signal);
});

peer.on('connect', () => {
    console.log('CONNECTED TO PHONE');
});
```

---

## 3. mobile.js

### ❌ Initial AI Draft

The first version was a simple script that assumed `localhost` would work on a mobile device.

### ✅ Refactored Final

I added extensive logging to troubleshoot the signaling handshake. I also confirmed that the mobile must be the initiator to match the project architecture.

```javascript
const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (roomId) {
    socket.emit('join', roomId);

    // SimplePeer initialization as Initiator (initiator: true)
    const peer = new SimplePeer({ initiator: true, trickle: false });

    peer.on('signal', signal => {
        console.log('Mobile generating signal...');
        socket.emit('signal', { roomId, signal });
    });

    socket.on('signal', data => {
        console.log('Mobile received signal from desktop');
        peer.signal(data.signal);
    });

    peer.on('connect', () => {
        console.log('CONNECTED TO DESKTOP');
    });

    peer.on('error', err => console.error('Peer error:', err));
}
```

---

## 4. HTML Structure (The Skeleton)

### ❌ Initial AI Draft

The initial HTML lacked the necessary library CDNs for SimplePeer and QRCode in the correct order.

### ✅ Refactored Final (Desktop)

I organized the scripts to ensure dependencies load before the main logic.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Ouija board - desktop</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Ouija Board</h1>
    <canvas id="qr-canvas"></canvas>
    <script src="/socket.io/socket.io.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/simple-peer/9.11.1/simplepeer.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
    <script src="desktop.js"></script>
</body>
</html>
```


## Current status
- [x] Local server running with `npm start`
- [x] One-to-one pairing via QR Code
- [x] Successful WebRTC "CONNECTED" log in console

# Phase 2: Polish, Physics & Paranormal Atmosphere (Feb 24 - 26, 2026)

---

## 1. The "Heavy" Movement (Physics & Math)

**Goal:** Transition from a "mouse pointer" feel to a "heavy wooden board" feel.

**The Problem:** Initially, the planchette "teleported" to the phone's coordinates. It felt digital and glitchy.

**Implementation:**

- **Lerp (Linear Interpolation):** I implemented a `currentX += (targetX - currentX) * friction` loop.
- **Friction Tuning:** Set the friction to `0.05` to create a "ghostly" lag that feels like physical weight.
- **Clamping:** Added `Math.max` and `Math.min` boundaries to ensure the spirit doesn't drag the planchette off-screen.

**AI Reflection:** I collaborated with AI to understand the "Lerp" math. Initially, my planchette was flying off-screen because I was adding movement indefinitely; AI helped me implement "Clamping" to keep it within the window.

---

## 2. The Secure Handshake (The "Sensor Lock" Breakthrough)

**Goal:** Unlock the mobile gyroscope to allow "Tilt-to-move" controls.

**The Problem:** I saw a "Sensor Permission Denied" error in the mobile console. The phone connected, but wouldn't send data.

**The AI Collaboration:** I prompted the AI about the error. It explained that modern browsers require a Secure Context (HTTPS) to access sensors. The AI suggested installing complex third-party SSL tools.

**The Class Integration:** I recalled the class example using a local HTTPS server. Instead of following the AI's complex route, I used the class-approved method using `key.pem` and `cert.pem`.

**The Fix:** Refactored `server.js` from an `http` server to an `https` server using the `fs` module to read my security keys.

---

## 3. Atmospheric UI (The Seance Experience)

**Goal:** Replace the "Tech Demo" look with a mystical, fire-lit ritual interface.

- **Flickering Candle Effect:** Created a CSS `@keyframes` animation that fluctuates `text-shadow` and `scale` to mimic a dancing flame.
- **The "Stage" System:** Used CSS Flexbox and JavaScript to hide the "Intro" screen and reveal the "Controller" screen (featuring the `heart_teller.png` asset) only after a successful P2P connection.

**The Brainstorming:**

While setting up the tilt controls, the AI suggested that a static image on the phone felt "dead." To solve this, the AI proposed a **3D Parallax effect** — making the planchette on the phone screen tilt in real-time to match the physical tilt of the hand.

**The AI's Code Suggestion:**

The AI provided this specific logic to map the gyroscope's `gamma` and `beta` degrees directly to CSS 3D transforms:

```javascript
// AI-suggested code for real-time visual feedback:
window.addEventListener('deviceorientation', (event) => {
    const img = document.getElementById('planchette-img');

    if (img) {
        // Map phone tilt to 3D rotation
        // rotateY uses gamma (left/right tilt)
        // rotateX uses beta (forward/backward tilt)
        img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
    }
});
```

**The Result:** By implementing this, I moved from a simple "data sender" to a **Tactile Controller**. The user gets immediate visual feedback on their phone, making the connection to the desktop planchette feel "magical" and physically linked.

---

## Code Evolution & AI Collaboration Log

### 1. Movement Logic

#### ❌ Initial AI Draft (Static Positioning)

```javascript
peer.on('data', data => {
    const motion = JSON.parse(data);
    planchette.style.left = motion.x + "px"; // Teleported instantly
});
```

#### ✅ Refactored "Heavy" Final (Collaborative)

```javascript
function animate() {
    // The "Chasing" math that makes it feel heavy
    currentX += (targetX - currentX) * friction;
    planchette.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    requestAnimationFrame(animate);
}
```

---

### 2. Server Security

#### ❌ Initial AI Draft (Insecure)

```javascript
const http = require('http');
const server = http.createServer(app); // Blocked sensors on mobile
```

#### ✅ Refactored "Secure" Final (Class Example Method)

```javascript
const https = require('https');

const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

const server = https.createServer(options, app); // Successfully unlocked Gyroscope
```

---

## 1. Initial Plan — AI Suggested WebRTC

I asked AI what the best way to send real-time motion data between two devices was. It recommended **WebRTC via SimplePeer** 

The idea: phone and desktop connect directly to each other ("peer-to-peer"), no server in the middle for the actual data.

**AI-suggested code:**
```javascript
// Phone sends motion data directly to desktop
const peer = new SimplePeer({ initiator: true, trickle: false });

peer.on('signal', data => {
    socket.emit('signal', { roomId, signal: data });
});

peer.on('connect', () => {
    window.addEventListener('deviceorientation', (event) => {
        peer.send(JSON.stringify({ x: event.gamma, y: event.beta }));
    });
});
```

```javascript
// Desktop receives it
peer.on('data', data => {
    const motion = JSON.parse(data);
    targetX += motion.x * 2.5;
    targetY += motion.y * 2.5;
});
```

This worked perfectly on my home Wi-Fi. I was happy. Then I went to school.

---

## 2. The Home vs. School Mystery

**The problem:** Everything broke the moment I switched to school Wi-Fi or my phone hotspot.

**What I figured out:**
- **Home Wi-Fi** (`192.168.x.x`) — permissive NAT, devices can see each other directly ✅
- **School Wi-Fi** (`172.30.x.x`) — uses **Client Isolation**. The firewall acts like a one-way mirror. Devices can reach the internet but cannot talk to each other directly ❌

WebRTC needs the two devices to find each other on the network. On school Wi-Fi, they are invisible to each other.

---

## 3. The Dead Relay — TURN Server Failure

To fix this, AI suggested adding a **TURN server** — a middleman that relays the data when direct connection is blocked.

**AI-suggested TURN config:**
```javascript
const peer = new SimplePeer({
    initiator: true,
    trickle: false,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    }
});
```

**What happened:** The console showed `Error: Connection failed` every time. The school network was so strict it blocked the DNS for `openrelay.metered.ca` entirely — the Mac could not even look up the address of the relay server. WebRTC was completely impossible on this network.

---

## 4. The Certificate Crisis — HTTPS & SSL

While debugging, I also hit a second wall: the **gyroscope on iPhone requires HTTPS**. My original certificate was generated with OpenSSL for `localhost` only:

```bash
# Old cert — only covers localhost, breaks when IP changes
openssl req -x509 -out localhost.crt -keyout localhost.key \
  -subj '/CN=localhost'
```

When the IP address changed at school (`172.30.97.16`), the browser saw that the certificate did not match and killed the connection. Sensors were blocked.

**The fix — mkcert:**

Instead of the complex third-party tools AI suggested, I used the class-approved method: `mkcert`. This creates a local Certificate Authority your devices can trust.

```bash
brew install mkcert
mkcert -install
mkcert localhost 127.0.0.1 ::1
mv localhost+2.pem localhost.crt
mv localhost+2-key.pem localhost.key
```

Updated `server.js` to use HTTPS:
```javascript
const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('./localhost.key'),
    cert: fs.readFileSync('./localhost.crt')
};

const server = https.createServer(options, app);
```

AirDropped the `rootCA.pem` to my iPhone and enabled **Full Trust** in iOS Settings → Certificate Trust Settings. Now the phone trusted my laptop as a secure server on any network.

---

## 5. The Final Fix — Socket.io Relay Architecture

After days of fighting WebRTC, I had a realization: **both devices were already connected to my laptop via Socket.io for the signalling layer**. I did not need WebRTC at all. I could just use the Socket.io connection that was already there to relay the motion data directly.

**Old architecture (broken at school):**
```
Phone ──(blocked P2P)──> Desktop
```

**New architecture (works everywhere):**
```
Phone ──> Socket.io Server (my laptop) ──> Desktop
```

### The refactor — 3 files changed:

**server.js — from "signalling helper" to "data messenger":**
```javascript
io.on('connection', (socket) => {
    socket.on('join', async (roomId) => {
        await socket.join(roomId);
        const room = io.sockets.adapter.rooms.get(roomId);
        // Tell desktop when phone joins the room
        if (room && room.size === 2) {
            socket.to(roomId).emit('peer-joined', socket.id);
        }
    });

    // Simply relay motion from phone to desktop — no WebRTC needed
    socket.on('motion', (data) => {
        socket.to(data.roomId).emit('motion', data);
    });
});
```

**mobile.js — removed SimplePeer entirely:**
```javascript
// ❌ Before: complex WebRTC peer connection
const peer = new SimplePeer({ initiator: true, trickle: false, config: { iceServers: [...] } });
peer.on('connect', () => {
    peer.send(JSON.stringify({ x: event.gamma, y: event.beta }));
});

// ✅ After: just use the socket that is already connected
function startMoving() {
    window.addEventListener('deviceorientation', (event) => {
        // Visual feedback — tilt the planchette image on the phone
        const img = document.getElementById('planchette-img');
        if (img) {
            img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
        }
        // Send motion through server relay — works on any network
        socket.emit('motion', { roomId, x: event.gamma, y: event.beta });
    });
}
```

**desktop.js — removed SimplePeer, just listen for motion:**
```javascript
// ❌ Before: waiting for WebRTC peer connection
peer.on('data', data => {
    const motion = JSON.parse(data);
    targetX += motion.x * 2.5;
});

// ✅ After: listen for the server relay event
socket.on('motion', (data) => {
    targetX += data.x * 2.5;
    targetY += data.y * 2.5;
    targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX));
    targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY));
});
```

**Result:** Works on home Wi-Fi, school Wi-Fi, hotspot — any network where the phone can reach the laptop. No external servers, no TURN relays, no complexity.

---
## Day 2 — Consulsult & Rebuilding Clean

After the first session where AI gave me an over-engineered solution with TURN servers and fallback timers, I had consult. The code was way too complex and that I should just follow the class pattern — simple SimplePeer, one STUN server, that's it.

So I rebuilt everything from scratch following the class examples.

---

### The Simple Server (following class pattern exactly)

The server has two jobs: manage rooms, and relay signals between peers.

```javascript
io.on('connection', (socket) => {
    clients[socket.id] = { id: socket.id };

    socket.on('join', (roomId) => {
        socket.join(roomId);
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size === 2) {
            // tell the phone the desktop's real socket.id
            const desktopId = [...room][0];
            socket.emit('peer-joined', desktopId);
        }
    });

    // relay signals between peers — exactly like class example
    socket.on('signal', (peerId, signal) => {
        console.log(`Received signal from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('signal', peerId, signal, socket.id);
    });

    socket.on('disconnect', () => {
        delete clients[socket.id];
    });
});
```

---

### Problem 1 — "Spirit detected!" fired twice

Desktop was logging "Spirit detected!" twice and then immediately erroring. This happened because `peer-joined` was being sent to everyone in the room instead of just the phone.

**The fix:** Only emit `peer-joined` when the second person joins (`room.size === 2`), and send it only to that second person with `socket.emit` (not `socket.to`):

```javascript
if (room && room.size === 2) {
    const desktopId = [...room][0]; // first joiner = desktop
    socket.emit('peer-joined', desktopId); // only tell the phone
}
```

---

### Problem 2 — Signals arriving but peer immediately erroring
 Desktop was logging "received signal 7 times" then "error" then "closed". Signals were arriving but the connection never completed.

**The root cause:** Mobile was sending signals to `roomId` (a random string like `q6601qq3y`) instead of the desktop's real socket.id. The server was doing `io.to(peerId)` but the peerId was a room name, not a socket — so the desktop never actually received the signals properly.

**Wrong mobile.js (what I had):**
```javascript
socket.on('connect', () => {
    socket.emit('join', roomId);
    createPeer(true, roomId); // ❌ roomId is not a socket.id!
});

peer.on('signal', data => {
    socket.emit('signal', roomId, data); // ❌ signals go nowhere
});
```

**Fixed mobile.js — wait for desktop's real socket.id:**
```javascript
let desktopId = null;

socket.on('connect', () => {
    socket.emit('join', roomId);
    // don't create peer yet — wait for desktop's real id
});

socket.on('peer-joined', (id) => {
    desktopId = id; // ✅ now we have the desktop's real socket.id
    createPeer(true, desktopId);
});

const createPeer = (initiator, peerId) => {
    peer = new SimplePeer({
        initiator,
        trickle: true,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    peer.on('signal', data => {
        socket.emit('signal', peerId, data); // ✅ sending to real socket.id
    });

    peer.on('connect', () => {
        console.log('CONNECTED!');
        if (navigator.vibrate) navigator.vibrate(200);
    });

    peer.on('close', () => { peer = null; });
    peer.on('error', () => console.log('error'));
};
```

---

### Desktop —  receiver

Desktop does NOT create the peer on `peer-joined`. Instead it waits for the signal to arrive, and only creates the peer when an `offer` comes in — exactly like my teacher's `receiver.html`:

```javascript
socket.on('signal', (myId, signal, peerId) => {
    console.log('Desktop received signal from', peerId);
    if (peer) {
        peer.signal(signal); // already exists, just pass signal
    } else if (signal.type === 'offer') {
        createPeer(false, peerId); // ✅ create only when offer arrives
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

    // receive gyroscope data over WebRTC data channel
    peer.on('data', data => {
        try {
            const motion = JSON.parse(data);
            targetX += motion.x * 2.5;
            targetY += motion.y * 2.5;
            targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX));
            targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY));
        } catch (e) { }
    });

    peer.on('close', () => { peer = null; });
    peer.on('error', () => console.log('error'));
};
```

---

# Dev Diary — Day 3 (March 7, 2026)
## Ghost Camera Feature 

---

## What I Was Trying to Build

I wanted to add a bonus feature: when you tilt the phone hard enough, a ghost appears on the desktop screen and flies across it. The twist — the ghost would show **your actual face** from the phone's front camera, composited onto a ghost image. Spooky and personal.

---

## Part 1 — Switching Back to WebRTC (for the Camera Stream)

The project had previously been simplified to a Socket.io relay for motion data (no WebRTC). But to send a **live camera stream** from phone to desktop, I needed WebRTC back — Socket.io can't carry video.

I asked AI to help re-introduce SimplePeer alongside the existing Socket.io signalling. The key architectural decision: **Socket.io stays for signalling only, SimplePeer handles the camera stream and motion data**.

**AI gave me this signalling pattern:**
```javascript
// server.js
socket.on('signal', (peerId, signal) => {
    io.to(peerId).emit('signal', peerId, signal, socket.id);
});

// desktop.js — wait for an offer before creating peer
socket.on('signal', (myId, signal, peerId) => {
    if (peer) {
        peer.signal(signal);
    } else if (signal.type === 'offer') {
        createPeer(false, peerId);
        peer.signal(signal);
    }
});
```

**The bug I had to fix myself:**

Mobile was sending signals to `roomId` (a random string like `"q6601qq3y"`) instead of the desktop's actual `socket.id`. The peer connection was going nowhere.

```javascript
// BROKEN — sending signal to room name, not socket id
socket.emit('signal', roomId, data);

// FIXED — server tells phone the desktop's real socket.id
socket.on('peer-joined', (desktopSocketId) => {
    desktopId = desktopSocketId;
    createPeer(true, desktopId); // now signals go to the right place
});
```

On the server side I added one line to send the desktop's real id to the phone:
```javascript
socket.on('join', (roomId) => {
    socket.join(roomId);
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.size === 2) {
        const desktopId = [...room][0];
        socket.emit('peer-joined', desktopId); // tell phone who to signal
    }
});
```

---

## Part 2 — The Ghost Trigger (`hauntScreen`)

AI suggested triggering the ghost when motion **intensity** (the combined tilt of both axes) crossed a threshold.

**AI gave me this:**
```javascript
const intensity = Math.abs(motion.x) + Math.abs(motion.y);
if (intensity > 25) {
    hauntScreen();
}
```

**Problem:** The threshold of 25 was way too low. Just holding the phone at a slight angle would constantly trigger the ghost. I debugged it by adding console logs to see real values:

```javascript
console.log('intensity:', intensity.toFixed(1), '| ghostImage:', !!ghostImage);
```

Watching the actual numbers, I saw normal holding was already around 40–50, so I changed the threshold to `> 60`. That way you have to **actually tilt it hard** to trigger the ghost.

I also added a `ghostCooldown` boolean so the ghost can't spam-trigger while you're holding the phone sideways, and a retry loop in `takeSnapshot()` because AI's original version would silently fail if the video wasn't ready yet:

```javascript
// AI version — silent fail if video not ready
function takeSnapshot() {
    const canvas = document.createElement('canvas');
    ctx.drawImage($video, 0, 0);
    ghostImage = canvas.toDataURL('image/png');
}

// My version — keeps retrying
function takeSnapshot() {
    if ($video.videoWidth === 0) {
        setTimeout(takeSnapshot, 1000); // retry
        return;
    }
    // ... draw to canvas
}
```

---

## Part 3 — The Race Condition Bug (Camera Not Arriving)

The trickiest bug of the day. `ghostImage` was always `false` even though the peer connection was working and motion data was flowing.

**Root cause:** A race condition between two things that needed to happen before the peer could be created with a camera stream:
1. Desktop sends its socket.id to phone (`peer-joined` event)
2. User clicks the button → camera permission requested → stream ready

If `peer-joined` arrived **before** the button was clicked (which it always did, sockets are fast), the phone would store `desktopId` but `myStream` was still null. Then when the button was clicked and the camera loaded, `createPeer` was called — but the peer was created with `stream: null` so no video was ever sent.

**AI's attempt** used `async/await` inside a socket event which was messy. I rewrote it with a simple `buttonClicked` flag:

```javascript
// My solution — two flags, whoever arrives last connects
let buttonClicked = false;

socket.on('peer-joined', (id) => {
    desktopId = id;
    if (buttonClicked) createPeer(true, desktopId); // camera already ready
});

startBtn.addEventListener('click', async () => {
    myStream = await navigator.mediaDevices.getUserMedia({ video: true });
    buttonClicked = true;
    if (desktopId) createPeer(true, desktopId); // desktop already ready
});
```

Whichever arrives last (camera OR desktop id) is the one that calls `createPeer`, guaranteeing both are ready.

---

## Part 4 — Ghost Visual Design

**First attempt (AI suggestion):** Show the face in a circle with `border-radius: 50%`. I didn't like it — looked like a profile picture floating on screen, not a ghost.

**Second attempt (AI suggestion):** Use CSS `border-radius: 50% 50% 30% 30%` to make a ghost body shape, with a floating CSS animation. Better but still not what I wanted.

**What I actually wanted:** A real photo of a ghost (like a sheet ghost) with my face composited onto the face area, flying across the screen.

I uploaded a ghost photo and AI helped remove the background using Python/Pillow to make it transparent:

```python
brightness = (r + g + b) / 3
is_dark = brightness < 130
is_orange = (r > 150) & (g < 120) & (b < 80)  # removes pumpkin
alpha = np.where(is_dark | is_orange, 0, np.clip((brightness - 100) * 2, 0, 255))
```

**Compositing order I figured out myself:**

AI originally put the face *behind* the ghost sheet at very low opacity — you couldn't see it at all. I switched the order:

```javascript
// LAYER 1: ghost sheet as base
ctx.drawImage(ghostSheet, 0, 0, W, H);

// LAYER 2: face ON TOP, clipped to face-hole oval — full brightness
ctx.save();
ctx.beginPath();
ctx.ellipse(faceCX, faceCY, faceRX, faceRY, 0, 0, Math.PI * 2);
ctx.clip();
ctx.filter = 'grayscale(0.8) brightness(1.0) contrast(1.15)';
ctx.drawImage($video, ...);
ctx.restore();

// LAYER 3: ghost sheet again at 25% — subtle veil so face looks inside the ghost
ctx.globalAlpha = 0.25;
ctx.drawImage(ghostSheet, 0, 0, W, H);
```

This gives the effect of the face being inside the ghost rather than just stuck on top of it.

**Size tuning I did manually:**

```javascript
// AI had this at 2.8 — face was bigger than the ghost head
const drawSize = faceRX * 2.0; // I changed to 2.0, fits the face hole correctly
```

---

## Part 5 — Snapshot Timing

Originally the snapshot only happened when the phone was tilted hard (on the `hauntScreen` trigger). So if you never tilted hard enough, you'd never get a ghost face.

I changed it to take the snapshot **immediately** when the stream arrives, with multiple retries:

```javascript
peer.on('stream', stream => {
    $video.srcObject = stream;
    $video.onloadedmetadata = () => {
        $video.play();
        // Take it right away, don't wait for tilting
        setTimeout(() => trySnapshot(), 1500);
        setTimeout(() => trySnapshot(), 3000);
        setTimeout(() => trySnapshot(), 5000);
    };
});
```

Also added a retry on every motion packet until the snapshot succeeds:
```javascript
peer.on('data', data => {
    if (!ghostImage) trySnapshot(); // keep trying until we have a face
    // ...
});
```

---

# Dev Diary (March 9, 2026)
## Letter Detection + Phone Feedback — AI Usage & What I Actually Changed

---

## What I Was Trying to Build Today

Coming in, the core tilting mechanic worked. Today's goals:

- Map the Ouija board letters so the planchette detects when it's over a letter (A–Z, YES, NO)
- When a letter is hit, glow it on the desktop and send a signal back to the phone
- Phone gives feedback when a letter is selected
- Fix a regression — the motion had broken again and needed debugging back to a working state

---

## Part 1 — Debugging: Motion Broke Again

### The Problem

Desktop showed `CONNECTED` and `Ghost+face composite ready!` but zero motion. Same symptom as a bug from Day 3.

### What AI Tried (Did Not Work)

- Adding `data.toString()` to the JSON.parse call
- Adding a `motion.x !== undefined` check
- Adding a `readyToSend` delay flag in mobile.js (made it worse, had to revert)

### Root Cause I Found

Looking at the console I saw this error:

```
peer error OperationError: User-Initiated Abort, reason=Close called
```

AI had re-introduced a `peer.destroy()` block when helping with a different problem. It was killing the working peer right after connection:

```javascript
// THIS WAS KILLING THE CONNECTION
if (peer && myStream) {
    peer.destroy();   // destroys the working peer
    peer = null;
    createPeer(true, desktopId);  // creates a new broken one
}
```

### My Fix

Removed the entire destroy block. Reverted to the simple `buttonClicked` flag pattern from Day 3 — camera first, then peer creation:

```javascript
let buttonClicked = false;

socket.on('peer-joined', (id) => {
    desktopId = id;
    if (buttonClicked) createPeer(true, desktopId); // camera already ready
});

// button click: get camera FIRST, then create peer
myStream = await navigator.mediaDevices.getUserMedia({ video: true });
buttonClicked = true;
if (desktopId) createPeer(true, desktopId);
```

---

## Part 2 — Mobile Button Not Visible on iPhone

### The Problem

Every time `mobile.html` was regenerated, the Enter Circle button disappeared off the bottom of the iPhone screen. The large `h1` title pushed it below the viewport.

### What AI Tried

Kept changing individual properties — font-size from 3.5rem to 2.5rem, removing `margin-bottom` from the `p` tag. These were partial fixes that kept breaking when the file was regenerated.

### My Fix

Changed `#intro-ui` to use flexbox with `gap` instead of margins. This keeps everything centred and visible regardless of font size:

```css
#intro-ui {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;    /* replaces all margin-bottom hacks */
    padding: 20px;
}
p { margin: 0; }
```

---

## Part 3 — Letter Detection Feature

### What AI Gave Me

AI gave me a `checkLetterHover()` function that runs every animation frame and checks if the planchette centre overlaps any letter element using `getBoundingClientRect()`:

```javascript
function checkLetterHover() {
    const px = currentX + 125; // centre of planchette
    const py = currentY + 40;  // near top hole of planchette
    let found = null;

    document.querySelectorAll('.board-letter, .board-word').forEach(el => {
        const r = el.getBoundingClientRect();
        if (px >= r.left - 8 && px <= r.right + 8 &&
            py >= r.top - 8 && py <= r.bottom + 8) {
            found = el.dataset.letter;
        }
    });

    if (found !== currentActiveLetter) {
        document.querySelectorAll('.board-letter, .board-word')
            .forEach(el => el.classList.remove('active'));
        if (found) {
            document.querySelector(`[data-letter="${found}"]`).classList.add('active');
            if (peer && peer.connected) {
                peer.send(JSON.stringify({ type: 'letter', value: found }));
            }
        }
        currentActiveLetter = found;
    }
}
```

AI also rewrote the board to use individual spans (instead of plain text paragraphs) so `getBoundingClientRect()` can target each letter:

```javascript
document.querySelectorAll('.board-content p').forEach(row => {
    const words = row.textContent.trim().split(/\s+/);
    row.innerHTML = '';
    words.forEach(word => {
        const span = document.createElement('span');
        span.dataset.letter = word;
        span.className = word.length === 1 ? 'board-letter' : 'board-word';
        span.style.margin = '0 8px';
        row.appendChild(span);
    });
});
```

### What I Changed

The letter glow CSS needed fixing — inactive letters were still showing through at 0.4 opacity from the parent `.board-content`. I added `!important` and a gold text-shadow to the active state:

```css
.board-letter.active {
    opacity: 1 !important;
    color: #fff8dc;
    text-shadow: 0 0 10px rgba(255,220,100,0.9),
                 0 0 28px rgba(255,180,0,0.6);
    transform: scale(1.3);
}
```

---

## Part 4 — Phone Feedback When Letter Hit

### Vibration (iOS Does Not Support This)

AI added `navigator.vibrate(120)` to mobile.js. This works on Android but iOS Safari completely blocks the Vibration API — Apple only allows haptics in native apps. There is no workaround for web.

### Letter Display on Phone

AI gave me a letter display element above the planchette. When desktop sends a letter over the WebRTC data channel, phone shows it in large text with a pop animation:

```javascript
peer.on('data', data => {
    const msg = JSON.parse(data);
    if (msg.type === 'letter') {
        const display = document.querySelector('#letter-display');
        display.textContent = msg.value;
        display.classList.remove('pop');
        void display.offsetWidth; // force reflow to restart animation
        display.classList.add('pop');
    }
});
```

### Screen Flash (My Addition for iOS)

Since vibration doesn't work on iOS for now I added a full-screen gold flash instead. Every time a letter is hit the whole phone screen briefly flashes gold — more noticeable than a subtle text change:

```javascript
const flash = document.createElement('div');
flash.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(212,175,55,0.18);
    pointer-events: none;
    z-index: 9999;
    animation: flashFade 0.35s ease-out forwards;
`;
document.body.appendChild(flash);
setTimeout(() => flash.remove(), 350);
```

---

## Wood Drag Sound

### What I Wanted to Build

I wanted the planchette to make a wood-scraping sound as it moves across the board, with the volume linked to how fast it's moving. Slow movement = quiet, fast tilt = loud scrape.

### What AI Gave Me

AI suggested using the Web Audio API to generate white noise filtered through a bandpass filter to simulate a scraping texture. It wrote the full `initAudio()` function that creates a noise buffer, loops it, and uses a gain node to control volume. It also added velocity calculation inside `animate()` by tracking `prevX`/`prevY` each frame:

```javascript
const vx = currentX - prevX;
const vy = currentY - prevY;
const speed = Math.sqrt(vx * vx + vy * vy);
scrapeGain.gain.setTargetAtTime(Math.min(speed * 0.08, 0.35), audioCtx.currentTime, 0.05);
```

### What I Changed

 I found wood scraping sound. I replaced the entire noise buffer approach with a real audio file loaded via `fetch()` and `decodeAudioData()`:

```javascript
fetch('/assets/wood_scrape.mp3')
    .then(r => r.arrayBuffer())
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => {
        scrapeSource = audioCtx.createBufferSource();
        scrapeSource.buffer = decoded;
        scrapeSource.loop = true;
        scrapeSource.connect(scrapeGain);
        scrapeGain.connect(audioCtx.destination);
        scrapeSource.start();
    });
```

I also increased the max volume from `0.35` to `0.9` since the real recording was quieter than the generated noise, and removed the filter frequency shifting since it's no longer needed with a real sound file.
