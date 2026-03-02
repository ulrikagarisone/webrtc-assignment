const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (roomId) {
    socket.emit('join', roomId);

    const startBtn = document.getElementById('start');
    startBtn.addEventListener('click', () => {
        startBtn.style.display = 'none';

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') {
                        showPlanchetteUI();
                        startMoving();
                    } else {
                        alert("Permission denied. Spirits require sensors!");
                    }
                })
                .catch(console.error);
        } else {
            showPlanchetteUI();
            startMoving();
        }
    });

    function showPlanchetteUI() {
        document.getElementById('intro-ui').style.display = 'none';
        const planchetteUI = document.getElementById('planchette-ui');
        planchetteUI.style.display = 'flex';
        setTimeout(() => { planchetteUI.style.opacity = '1'; }, 10);
    }

    function startMoving() {
        window.addEventListener('deviceorientation', (event) => {
            // Tilt the image on the phone for local feedback
            const img = document.getElementById('planchette-img');
            if (img) {
                img.style.transform = `rotateY(${event.gamma}deg) rotateX(${-event.beta}deg)`;
            }

            // Send motion directly through socket.io — no WebRTC needed.
            // The server relays it to the desktop in the same room.
            socket.emit('motion', { roomId, x: event.gamma, y: event.beta });
        });
    }
}