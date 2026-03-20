# WebRTC Assignment: The Ouija Experience 

## Project Overview Idea
This project is a one-to-one interactive experience where a smartphone (mobile) acts as a planchette to control a desktop Ouija board. It uses WebSockets for signaling and WebRTC Data Channels for real-time sensor-based control.

## How to Run

1. `npm install`
2. `npm start`
3. Open the HTTPS URL printed in the terminal in Chrome
4. Scan the QR code with your iPhone — open in **Safari** or Chrome
5. Both devices must accept the SSL warning (Advanced → Proceed) since the certificate is self-signed with mkcert
6. Both devices must be on the **same WiFi network** as the laptop running the server

## Development Diary

### Feb 17 – 21, 2026: Project Setup

---

## Phase 1 — Server & Signalling

**Goal:** Build the server that lets two devices find each other and set up a WebRTC connection.

#### What AI gave me

AI generated this initial server — it used a hardcoded Mac hostname that would break on any other computer, and a signal relay that passed the whole data object instead of separating peerId and signal:

```javascript
// AI's first server.js — hardcoded hostname, breaks everywhere else
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Go to: http://Ulrikas-MacBook-Pro.local:${PORT}/desktop.html`);
});

// AI's signal relay — messy, bundles roomId into data object
socket.on('signal', (data) => {
    socket.to(data.roomId).emit('signal', {
        sender: socket.id,
        signal: data.signal
    });
});
```

AI also gave me this for the Room ID in `desktop.js` — using the deprecated `.substr()`:
```javascript
// AI's version — deprecated method
const roomId = Math.random().toString(36).substr(2, 9);
```

#### What I changed

I made the server dynamic so it prints the actual IP address at startup — so it works on any machine and any network without editing the code:

```javascript
// My fix — works on any machine
server.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`https://${net.address}:${PORT}`);
            }
        }
    }
});
```

I also rebuilt the signal relay to match the class pattern exactly — separate `peerId` and `signal` params, and the three-argument emit so the receiver knows who sent it:

```javascript
// My version — matches class example pattern
socket.on('signal', (peerId, signal) => {
    io.to(peerId).emit('signal', peerId, signal, socket.id);
});
```

And updated the Room ID to use modern `.substring()`:
```javascript
// My fix — modern, supported in all browsers
const roomId = Math.random().toString(36).substring(2, 11);
```

---

## Phase 2 — QR Code Pairing

#### What AI gave me

AI hardcoded a static URL for the QR code — this would only work on one specific network:

```javascript
// AI's version — hardcoded, only works on one network
const url = 'http://Ulrikas-MacBook-Pro.local:3000/mobile.html?room=' + roomId;
QRCode.toCanvas(document.getElementById('qr-canvas'), url);
```

AI also used `getElementById` for the canvas element.

#### What I changed

I switched to `window.location` so the URL adapts automatically to whatever address the server is running on. I also switched to `querySelector`:

```javascript
// My fix — dynamic, works on any network
const url = `${window.location.protocol}//${window.location.host}/mobile.html?room=${roomId}`;
QRCode.toCanvas(document.querySelector('#qr-canvas'), url);
```


**The Problem**: My project worked perfectly on my Mac, but when I scanned the QR code with my iPhone, I got a "Server Not Found" error. I had to troubleshoot the network path between the two devices.

#### Step 1: The "localhost" mistake
* **Discovery**: I was initially using `http://localhost:3000`.
* **AI Explanation**: Gemini explained that `localhost` is a "loopback" address that refers only to "this specific device." When scanned, my iPhone was looking for the server on itself instead of finding my Mac.

#### Step 2: The ".local" hostname attempt
* **Action**: Based on initial AI advice, I tried using my Mac's local hostname: 
    `const url = 'http://Ulrikas-MacBook-Pro.local:3000/...'`
* **Result**: This worked occasionally, but proved unreliable. I learned that hostnames like `.local` depend on specific router configurations and "mDNS" support, which isn't always stable on every Wi-Fi network.

#### Step 3: The solution (Dynamic IP)
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

# Phase 2: Polish, Physics & Paranormal Atmosphere (Feb 24 - 26, 2026)

---

## 1. The "Heavy" Movement (Physics & Math)

**Goal:** Transition from a "mouse pointer" feel to a "heavy wooden board" feel.

**The Problem:** Initially, the planchette "teleported" instantly to wherever the phone was tilted — it felt like a cursor, not a haunted object.

#### What AI gave me

AI explained the Lerp (linear interpolation) concept and gave me this pattern — the planchette chases its target instead of jumping to it:

```javascript
// AI's lerp concept
peer.on('data', data => {
    const motion = JSON.parse(data);
    targetX += motion.x * 2.5;
    targetY += motion.y * 2.5;
});

function animate() {
    currentX += (targetX - currentX) * 0.05; // lerp toward target
    currentY += (targetY - currentY) * 0.05;
    planchette.style.left = currentX + 'px';
    planchette.style.top = currentY + 'px';
    requestAnimationFrame(animate);
}
animate();
```

#### What I changed

AI's version didn't include any boundaries — the planchette flew off screen if you tilted too far. I added clamping with `Math.max` / `Math.min` to keep it inside the window:

```javascript
// My addition — boundaries so it can't leave the screen
peer.on('data', data => {
    const motion = JSON.parse(data);
    targetX += motion.x * 2.5;
    targetY += motion.y * 2.5;
    targetX = Math.max(0, Math.min(window.innerWidth - 250, targetX));
    targetY = Math.max(0, Math.min(window.innerHeight - 250, targetY));
});
```

I also reduced friction from `0.05` to `0.02` after testing — `0.05` was too snappy and didn't feel heavy enough. At `0.02` the planchette lags behind meaningfully, like something being dragged through resistance.

---

## 2. The connection with gyroscope

**Goal:** Unlock the mobile gyroscope to allow "Tilt-to-move" controls.

**The Problem:** I saw a "Sensor Permission Denied" error in the mobile console. The phone connected, but wouldn't send data.

**What AI suggested:**

AI told me to install a third-party SSL proxy tool and set up a domain tunnel. It gave me this complicated setup involving ngrok and external services:

```bash
# AI's suggestion — complex, requires external account
npm install -g ngrok
ngrok http 3000
# then update all your URLs to the ngrok tunnel address
```

This was overly complicated and would break every time the tunnel URL changed.

**What I actually did — class method with mkcert:**

Instead I used the method from the class examples: `mkcert`. This creates a local Certificate Authority that your devices trust permanently:

```bash
brew install mkcert
mkcert -install
mkcert localhost 127.0.0.1 ::1
mv localhost+2.pem localhost.crt
mv localhost+2-key.pem localhost.key
```

Then updated `server.js` to use HTTPS:

```javascript
const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('./localhost.key'),
    cert: fs.readFileSync('./localhost.crt')
};

const server = https.createServer(options, app);
```

AirDropped the `rootCA.pem` to my iPhone and enabled Full Trust in iOS Settings → Certificate Trust Settings. Now the phone trusted my laptop as a secure server on any network — no external services, no tunnel.

---

## 3. Atmospheric UI (The Seance Experience)

**Goal:** Replace the "Tech Demo" look with a mystical, fire-lit ritual interface.

#### What AI gave me

AI gave me a candle flicker animation using `@keyframes` to fluctuate `text-shadow` and `scale` on the title, and a stage-switch system using JavaScript to hide the intro screen and show the controller once connected:

```css
/* AI's candle flicker animation */
@keyframes flicker {
    0%, 100% {
        text-shadow: 0 0 10px rgba(212,175,55,0.3), 0 0 20px rgba(255,140,0,0.1);
        transform: scale(1);
    }
    50% {
        text-shadow: 0 0 30px rgba(212,175,55,0.7), 0 0 40px rgba(255,140,0,0.3);
        transform: scale(1.01);
    }
}
h1 { animation: flicker 3s infinite alternate; }
```

```javascript
// AI's stage switch — hide intro, show controller on connect
peer.on('connect', () => {
    document.getElementById('intro-ui').style.display = 'none';
    document.getElementById('planchette-ui').style.display = 'flex';
});
```

#### What I changed

The `getElementById` calls needed to become `querySelector`. I also added a fade transition so the screen change isn't abrupt — the intro fades out over 1 second before the controller appears:

```javascript
// My version — querySelector + fade transition
peer.on('connect', () => {
    const intro = document.querySelector('#intro-ui');
    intro.style.transition = 'opacity 1s';
    intro.style.opacity = '0';
    setTimeout(() => {
        intro.style.display = 'none';
        const ui = document.querySelector('#planchette-ui');
        ui.style.display = 'flex';
        setTimeout(() => { ui.style.opacity = '1'; }, 10);
    }, 1000);
});
```

While setting up the tilt controls, AI also suggested a **3D Parallax effect** on the phone planchette image.

**What AI gave me:**

AI suggested the phone planchette image should tilt in 3D to match the physical tilt of the hand — giving the user visual feedback that their tilting is being tracked. It gave me this full implementation:

```javascript
// AI's suggestion — 3D parallax on the phone planchette
window.addEventListener('deviceorientation', (event) => {
    const img = document.getElementById('planchette-img');
    if (img) {
        // gamma = left/right tilt, beta = forward/back tilt
        img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
    }
});
```

**What I changed:**

I kept this mostly as-is because it was a genuinely good suggestion. The only thing I changed was switching `getElementById` to `querySelector` and caching the `img` element outside the event listener so it isn't queried 60 times per second:

```javascript
// My version — querySelector + cached outside the listener
const startMoving = () => {
    const img = document.querySelector('#planchette-img'); // cached once
    window.addEventListener('deviceorientation', (event) => {
        if (img) img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
        if (peer && peer.connected) {
            peer.send(JSON.stringify({ x: event.gamma, y: event.beta }));
        }
    });
};
```

This turned the phone from a data sender into a tactile controller — users feel physically connected to the desktop board.
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

This worked perfectly on my home Wi-Fi. I was happy. Then I went to uni and the planchette connected but wouldn't move — motion data wasn't getting through

---

## 2. The Home vs. University Mystery

**The problem:** Everything broke the moment I switched to university Wi-Fi  (planchette connected but wouldn't move) or my phone hotspot.

**I noticed the IP addresses were different between home and school, which led me to research why that mattered.**
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
**However:**The Socket.io relay worked, but it wasn't the right architecture — the assignment specifically requires WebRTC data channels for the controls. At the next consult it was confirmed and the end desition was to go back and restracture everything as we did in class. I rebuilt it properly using SimplePeer with Socket.io for signalling only, which is documented in Day 2.
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

**Fixed mobile.js with AI — wait for desktop's real socket.id:**
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

Desktop does NOT create the peer on `peer-joined`. Instead it waits for the signal to arrive, and only creates the peer when an `offer` comes in — exactly like class `receiver.html`:

```javascript
socket.on('signal', (myId, signal, peerId) => {
    console.log('Desktop received signal from', peerId);
    if (peer) {
        peer.signal(signal); // already exists, just pass signal
    } else if (signal.type === 'offer') {
        createPeer(false, peerId); //  create only when offer arrives
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

**The bug I had to fix**

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

**Compositing order I figured**

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

**Size tuning**

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
## Letter Detection + Phone Feedback — AI Usage & What I Changed

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

-------

# Possession Mode

### What I Wanted to Build

I wanted a "Possession Mode" where the board occasionally takes over and moves the planchette on its own. My idea was to trigger it when the planchette hovers over NO — felt more thematic than a random timer. I also wanted a creepy sound to play when it happens.

### What AI Gave Me

AI's first version spelled out scary words letter by letter (BEHIND YOU, HELP ME, GET OUT, RUN) triggered by a random timer every 25-45 seconds. It calculated each letter's position using `getBoundingClientRect()` and moved the planchette to each one with a 1.2 second delay between letters. It also added a red screen flash and a generated eerie drone using two detuned sine wave oscillators through the Web Audio API:

```javascript
const osc = audioCtx.createOscillator();
const osc2 = audioCtx.createOscillator();
osc.frequency.setValueAtTime(55, audioCtx.currentTime);
osc2.frequency.setValueAtTime(58.5, audioCtx.currentTime); // slight detune
gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.8);
gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 6);
```

### What I Changed

**I dropped the spelling entirely.** Spelling specific words would break on different screen sizes (but I added the back after consult) since letter positions are pixel-based. Instead I made the planchette move to random positions every 500ms for 6 seconds — simpler, works on any screen, and honestly feels creepier because it's unpredictable:

```javascript
possessionInterval = setInterval(() => {
    elapsed += 500;
    targetX = Math.random() * (window.innerWidth - 250);
    targetY = Math.random() * (window.innerHeight - 250);
    if (elapsed >= 6000) {
        clearInterval(possessionInterval);
        possessed = false;
    }
}, 500);
```

**I changed the trigger from a timer to hovering over NO.** The random timer felt disconnected from the experience. Hovering over NO to trigger possession makes narrative sense — you're asking the spirits and they answer by taking over. This was my idea:

```javascript
if (found === 'NO') triggerPossession();
```

**I replaced the generated drone with a real recorded sound.** I found and downloaded a creepy possession sound and loaded it the same way as the wood scrape — via `fetch()` and `decodeAudioData()`. The real recording is much more atmospheric than synthesized oscillators.

## Dev Diary — March 15, 2026
## Teacher Consult Feedback + Refactor + Game Logic
 
---
 
### Part 1 — Teacher Feedback: Code Quality
 
After the consult my teacher gave me three things to fix:
 
**1. Audio — replace `.then()` chains with `async/await`**
 
What AI originally gave me:
```javascript
fetch('/assets/wood_scrape.mp3')
    .then(r => r.arrayBuffer())
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => {
        scrapeSource = audioCtx.createBufferSource();
        scrapeSource.buffer = decoded;
        scrapeSource.loop = true;
        scrapeGain = audioCtx.createGain();
        scrapeGain.gain.value = 0;
        scrapeSource.connect(scrapeGain);
        scrapeGain.connect(audioCtx.destination);
        scrapeSource.start();
    });
```
 
What I changed it to — async/await is cleaner and the current best practice. I also extracted a `loadSound()` helper since the same fetch/decode pattern was repeated three times across the file:
```javascript
const loadSound = async (url) => {
    const buffer = await (await fetch(url)).arrayBuffer();
    return audioCtx.decodeAudioData(buffer);
};
 
const initAudio = async () => {
    if (audioCtx) return;
    audioCtx = new AudioContext();
    const decoded = await loadSound('/assets/wood_scrape.mp3');
    scrapeSource = audioCtx.createBufferSource();
    scrapeSource.buffer = decoded;
    scrapeSource.loop = true;
    scrapeGain = audioCtx.createGain();
    scrapeGain.gain.value = 0;
    scrapeSource.connect(scrapeGain);
    scrapeGain.connect(audioCtx.destination);
    scrapeSource.start();
};
```
 
I also replaced `new (window.AudioContext || window.webkitAudioContext)()` with just `new AudioContext()` — `webkitAudioContext`.
 
**2. Remove vibration**
 
AI had added `navigator.vibrate()` for letter feedback. I use iPhone and vibration is completely blocked on iOS Safari. Removed from `mobile.js`.
 
**3. Avoid unnecessary try/catch**
 
What AI gave me:
```javascript
socket.on('signal', (myId, signal, peerId) => {
    try {
        if (peer) peer.signal(signal);
    } catch(e) { console.log(e); }
});
```
 
What I changed it to:
```javascript
socket.on('signal', (_myId, signal, _peerId) => {
    if (peer) peer.signal(signal);
});
```
 
The underscore prefix on `_myId` and `_peerId` tells the linter these parameters are intentionally unused.
 
---
 
### Part 2 — Desktop Start Screen
 
#### What AI Gave Me
AI added an invisible full-screen overlay div to capture the first click and unlock AudioContext:
```javascript
const unlock = document.createElement('div');
unlock.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:default;';
unlock.addEventListener('click', () => { initAudio(); unlock.remove(); }, { once: true });
document.body.appendChild(unlock);
```
This worked but felt wrong — users had no idea they needed to click, and it blocked interaction with the board.
 
#### What I Changed
I made for a proper start screen instead — a visible overlay with a "Begin Séance" button matching the mobile aesthetic. The button has a clear purpose AND unlocks audio as a side effect:
```javascript
document.querySelector('#begin-btn').addEventListener('click', () => {
    initAudio();
    const screen = document.querySelector('#start-screen');
    screen.style.opacity = '0';
    setTimeout(() => { screen.style.display = 'none'; }, 1000);
});
```
 
---
 
### Part 3 — Board Redesign
 
#### What AI Gave Me
AI restructured the layout using `justify-content: space-evenly`, Cinzel Decorative for the title, YES/NO on opposite sides, gold `✦` dividers, and `clamp()` on all font sizes so the layout scales to any screen.
 
#### What I Changed
I uploaded a custom SVG decorative pattern (`board_pattern.svg`) and replaced the CSS grain with it as a full-screen background overlay:
```css
body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url('/assets/board_pattern.svg');
    background-size: cover;
    opacity: 0.08;
    filter: invert(1) sepia(1) saturate(2) hue-rotate(5deg);
    pointer-events: none;
    z-index: 1;
}
```
 
I also pushed for a clearer size hierarchy — title at `6.5vw`, YES/NO bold and wide apart, letters at `3.8vw`, numbers smaller, GOOD BYE barely visible at the bottom.
 
---
 
### Part 4 — Possession Mode Improvements
 
#### What AI Originally Gave Me
The first version triggered on a random timer every 25–45 seconds, moved the planchette randomly across the whole screen, and just flashed red:
```javascript
function schedulePossession() {
    const delay = 25000 + Math.random() * 20000;
    possessionTimeout = setTimeout(triggerPossession, delay);
}
 
possessionInterval = setInterval(() => {
    elapsed += 500;
    targetX = Math.random() * (window.innerWidth - 250);
    targetY = Math.random() * (window.innerHeight - 250);
    if (elapsed >= 6000) {
        clearInterval(possessionInterval);
        possessed = false;
    }
}, 500);
```
 
#### What I Changed
 
**Trigger** — changed from random timer to hovering over NO. Makes narrative sense — you ask the spirits and they answer by possessing the board:
```javascript
if (found === 'NO') triggerPossession();
```
 
**Visual** — replaced the basic red flash with a vignette that closes in from the edges:
```javascript
const vignette = document.createElement('div');
vignette.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at center, transparent 30%, rgba(80,0,0,0.85) 100%);pointer-events:none;z-index:997;opacity:0;transition:opacity 0.8s;';
document.body.appendChild(vignette);
setTimeout(() => { vignette.style.opacity = '1'; }, 50);
```
 
**Board title shake** — added a shake effect when possession triggers:
```javascript
const shakeInterval = setInterval(() => {
    title.style.transform = `translate(${(Math.random()-0.5)*12}px, ${(Math.random()-0.5)*8}px)`;
    if (++shakes > 10) { clearInterval(shakeInterval); title.style.transform = ''; }
}, 80);
```
 
**Bounds** — planchette now stays within the board area instead of flying off screen. I also split `triggerPossession` into smaller single-purpose functions per my teacher's style:
```javascript
const getBoardBounds = () => {
    const r = document.querySelector('#board-wrap')?.getBoundingClientRect();
    return {
        minX: r ? r.left + 40 : 100,
        maxX: r ? r.right - 290 : window.innerWidth - 290,
        minY: r ? r.top + 40 : 100,
        maxY: r ? r.bottom - 290 : window.innerHeight - 290
    };
};
 
const showPossessionEffect = () => { /* creates vignette + flash */ };
const shakeBoardTitle = () => { /* shakes the title */ };
const movePossessedPlanchette = (onDone) => { /* moves randomly within bounds */ };
 
const triggerPossession = async () => {
    if (possessed) return;
    possessed = true;
    const { vignette, flash } = showPossessionEffect();
    shakeBoardTitle();
    // play sound...
    movePossessedPlanchette(() => {
        vignette.style.opacity = '0';
        setTimeout(() => { vignette.remove(); flash.remove(); }, 1000);
        possessed = false;
    });
};
```
 
---
 
### Part 5 — Performance: Pre-calculating Letter Positions
 
My teacher pointed out that `getBoundingClientRect()` inside the animation loop reads the DOM 60 times per second.
 
**What AI gave me — querying every frame:**
```javascript
letterElements.forEach(el => {
    const r = el.getBoundingClientRect(); // called 60x per second!
    if (px >= r.left - 8 && px <= r.right + 8 && ...) found = el.dataset.letter;
});
```
 
**What I changed it to — calculate once at startup:**
```javascript
const letterElements = [...document.querySelectorAll('.board-letter, .board-word')];
const letterRects = letterElements.map(el => ({ el, r: el.getBoundingClientRect() }));
 
letterRects.forEach(({ el, r }) => {
    // just comparing numbers — no DOM reads per frame
    if (px >= r.left - 8 && px <= r.right + 8 && ...) found = el.dataset.letter;
});
```
 
The board doesn't move so the positions never change — no reason to re-read them every frame.
 
---
 
### Part 6 — Game Logic: Watch Then Spell
 
#### The Idea
A game that makes sense with the Ouija theme: the spirits spell a word by moving the planchette on their own while creepy music plays, then the player repeats the word by tilting.
 
#### What AI Gave Me
AI built a game state machine with three phases — `watching`, `spelling`, `idle`. The core function `spiritSpellNext()` recursively moves the planchette to each letter:
 
```javascript
function getLetterPosition(letter) {
    const el = document.querySelector(`[data-letter="${letter}"]`);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - 125, y: r.top + r.height / 2 - 40 };
}
 
function spiritSpellNext() {
    if (spiritSpellIndex >= targetWord.length) { return; }
    const letter = targetWord[spiritSpellIndex];
    const pos = getLetterPosition(letter);
    if (pos) { targetX = pos.x; targetY = pos.y; }
 
    setTimeout(() => {
        collectedLetters.push(letter);
        renderWordDisplay();
        spiritSpellIndex++;
        spiritSpellNext();
    }, 1400); // AI's original delay
}
```
 
AI also wrote the popup system, word display with `_` slots, and win condition triggering the ghost.
 
#### What I Changed
 
**Phone motion blocked during watch phase** — AI didn't think of this. When the spirits are spelling, tilting the phone disrupts the planchette:
```javascript
if (!possessed && gamePhase !== 'watching') {
    targetX += motion.x * 1.6;
    targetY += motion.y * 1.6;
}
```
 
**Timing** — AI's 1400ms wasn't long enough for the planchette to arrive at each letter (lerp friction `0.02`). I increased to 2200ms after testing.
 
**Creepy music** — I wanted the possessed sound looping while spirits spell. AI wrote `playSpiritSound()` using the new async/await + `loadSound()` pattern:
```javascript
const playSpiritSound = async () => {
    if (!audioCtx) return;
    const decoded = await loadSound('/assets/possesd_sound.mp3');
    spiritSoundSource = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    spiritSoundSource.buffer = decoded;
    spiritSoundSource.loop = true;
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 1.5);
    spiritSoundSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    spiritSoundSource.start();
};
```
 
**Red overlay** — I asked for the screen to go red while spirits spell. AI added a div that fades in/out:
```javascript
spiritOverlay = createOverlay('position:fixed;inset:0;background:rgba(80,0,0,0.25);pointer-events:none;z-index:3;transition:opacity 1s;opacity:0;');
setTimeout(() => { spiritOverlay.style.opacity = '1'; }, 50);
```
 
**Removed wrong-letter popup** — AI showed a "WRONG" popup on every wrong letter which fired constantly during normal tilting. I removed it — wrong letters just shake the board silently instead.
 
---

### Part 7 — Game Ending: Spirit Question + YES/NO
 
#### The Idea
After 3 rounds the spirits ask a scary yes/no question. Both YES and NO lead to different spooky outcomes — there's no safe answer.
 
#### What AI Gave Me
AI built a `SPIRIT_QUESTIONS` array and `endGame()` function:
```javascript
const SPIRIT_QUESTIONS = [
    {
        question: 'ARE YOU ALONE?',
        yes: { msg: 'YOU ARE NEVER ALONE', sub: 'i have been here all along... restarting', scary: true },
        no:  { msg: 'ARE YOU SURE?', sub: 'the spirits disagree... good bye for now', scary: false }
    },
    // ...
];
 
const endGame = () => {
    gamePhase = 'question';
    currentQuestion = SPIRIT_QUESTIONS[Math.floor(Math.random() * SPIRIT_QUESTIONS.length)];
    showPopup('✦ THE SÉANCE IS COMPLETE ✦', `you communicated ${score} of ${MAX_ROUNDS} words`);
    // ... show question popup after delay
};
```
 
#### What I Changed
 
**`window._spiritQuestion` → proper variable** — AI stored the current question as `window._spiritQuestion` which is a global property on the window object — bad practice. I replaced it with a proper `let currentQuestion = null` declared at the top of the file with all the other game variables:
```javascript
// AI's version — polluting the global window object
window._spiritQuestion = q;
if (!window._spiritQuestion) return;
 
// My fix — proper scoped variable at top of file
let currentQuestion = null;
// ...
currentQuestion = q;
if (!currentQuestion) return;
```
 
**Question design** — AI gave me the structure but I wrote all the questions and outcomes myself. The design principle I came up with: both YES and NO always lead somewhere spooky so the player can never feel safe — the spirits always win. I also made sure each YES/NO pair was logically consistent with the question:
- `ARE YOU ALONE?` → YES = "YOU ARE NEVER ALONE, i have been here all along" + possession, NO = "ARE YOU SURE? the spirits disagree... good bye"
- `ARE YOU AFRAID?` → YES = "GOOD, fear keeps you alive for now" (safe), NO = "YOU SHOULD BE" + possession
- `DO YOU FEEL SAFE?` → YES = "HOW NAIVE, safety is an illusion" + possession, NO = "WISE, good bye"
- `IS SOMEONE WATCHING YOU?` → YES = "CORRECT, it has been watching this whole time" (safe), NO = "LOOK BEHIND YOU" + possession
 
**Both answers trigger something** — AI's first version only had a scary outcome for one answer and a boring "game over" for the other. I changed it so both paths lead to something dramatic — either possession + ghost + restart, or a creepy farewell message + GOOD BYE. Neither answer feels safe.
 
**Sensitivity tuned through testing** — the planchette was accidentally triggering YES/NO while the player was trying to spell letters nearby. I tested different values and settled on `1.6` as a good balance between responsive and calm:
```javascript
// AI's original — too sensitive, YES/NO triggered by accident
targetX += motion.x * 2.5;
 
// My fix — calmer movement after testing
targetX += motion.x * 1.6;
```
 
**NO during spelling phase removed** — AI originally had NO trigger possession at any time including during the spelling phase. This made the game unplayable — every time you passed over NO while trying to spell, the whole screen went red and the round reset. I removed it so NO only responds during the final question phase where it makes narrative sense:
```javascript
// AI's version — NO triggered possession at any time
if (found === 'NO' && !possessed) triggerPossession();
 
// My fix — NO only works during the question phase
if (found === 'NO') {
    if (gamePhase === 'question') answerSpiritQuestion('NO');
    // else: do nothing during normal gameplay
}
```