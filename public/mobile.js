const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (roomId) {
    socket.emit('join', roomId);

    // SimplePeer as initiator 
    const peer = new SimplePeer({ initiator: true, trickle: false });

    peer.on('signal', signal => {
        socket.emit('signal', { roomId, signal });
    });

    socket.on('signal', data => {
        peer.signal(data.signal);
    });

    peer.on('connect', () => {
        console.log('CONNECTED TO DESKTOP');
        peer.send('The spirits are restless...');
    });
}