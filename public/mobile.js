const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (roomId) {
    // Tell the server we are joining
    socket.emit('join', roomId);

    // Wait a tiny bit or just start after the emit
    // SimplePeer as initiator 
    const peer = new SimplePeer({ initiator: true, trickle: false });

    peer.on('signal', signal => {
        console.log('Mobile generated signal, sending to desktop...');
        socket.emit('signal', { roomId, signal });
    });

    socket.on('signal', data => {
        console.log('Mobile received signal from desktop');
        peer.signal(data.signal);
    });

    peer.on('connect', () => {
        console.log('CONNECTED TO DESKTOP');
        peer.send('The spirits are restless...');
    });

    peer.on('data', data => {
        console.log('Message from Mac:', data.toString());
        alert('The Mac says: ' + data.toString());
    });

    // to catch errors
    peer.on('error', err => console.error('Peer error:', err));
}