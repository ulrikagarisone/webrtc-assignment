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

## AI Reflection

| | What happened |
|---|---|
| **What AI suggested** | WebRTC P2P via SimplePeer — technically correct for low latency |
| **Why it failed** | School network blocks P2P and TURN relay DNS entirely |
| **What AI missed** | The simpler solution already existed — Socket.io was already connected |
| **What I changed** | Removed WebRTC completely, used Socket.io relay instead |
| **What I learned** | AI gives the "industry standard" answer, not the "works in your specific situation" answer |


