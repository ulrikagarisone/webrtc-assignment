const socket = io();
const roomId = Math.random().toString(36).substring(2, 11);
socket.emit('join', roomId);

// Generate QR Code
const url = `${window.location.protocol}//${window.location.host}/mobile.html?room=${roomId}`;
QRCode.toCanvas(document.getElementById('qr-canvas'), url)

// SimplePeer as receiver 
const peer = new SimplePeer({ initiator: false, trickle: false });

// Every time the desktop generates a piece of the signal, this code triggers
peer.on('signal', signal => {
    socket.emit('signal', { roomId, signal });
});

// listens for any signals coming from the server
socket.on('signal', data => {
    peer.signal(data.signal);
});

peer.on('connect', () => {
    console.log('CONNECTED TO PHONE');
    peer.send('The spirits say hello!');
});