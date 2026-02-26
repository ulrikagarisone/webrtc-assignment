const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (roomId) {
    socket.emit('join', roomId);

    const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    peer.on('signal', signal => {
        socket.emit('signal', { roomId, signal });
    });

    socket.on('signal', data => {
        peer.signal(data.signal);
    });

    const startBtn = document.getElementById('start');

    startBtn.addEventListener('click', () => {
        // Hide button so the user knows they clicked it
        startBtn.style.display = 'none';

        // Request sensors (only works on HTTPS)
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') {
                        startMoving();
                    } else {
                        alert("Permission denied. Refresh and try again!");
                    }
                })
                .catch(console.error);
        } else {
            // Android or older iOS
            startMoving();
        }
    });

    function startMoving() {
        window.addEventListener('deviceorientation', (event) => {
            const data = { x: event.gamma, y: event.beta };

            // Tilt the image on the phone screen for feedback
            const img = document.getElementById('planchette-img');
            if (img) {
                img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
            }

            if (peer.connected) {
                peer.send(JSON.stringify(data));
            }
        });
    }

    peer.on('connect', () => {
        document.getElementById('intro-ui').style.display = 'none';
        const planchetteUI = document.getElementById('planchette-ui');
        planchetteUI.style.display = 'flex';

        setTimeout(() => {
            planchetteUI.style.opacity = '1';
        }, 10);
    });

    peer.on('close', () => {
        document.body.style.backgroundColor = "white";
        document.body.style.color = "black";
        document.querySelector('h1').innerText = "The Spirit has left...";
        alert("Connection lost. Please refresh the page!");
    });

    peer.on('error', err => console.error('Peer error:', err));
}