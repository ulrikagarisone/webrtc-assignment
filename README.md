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