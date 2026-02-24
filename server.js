const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Spirit connected:', socket.id);

    // join event 
    socket.on('join', (roomId) => {
        socket.join(roomId);
        console.log(`Socket joined room: ${roomId}`);
    });

    // WebRTC signals (SDP/ICE candidates) 
    //It takes the connection data from one device and emits it to the other device in the same Room ID
    socket.on('signal', (data) => {
        socket.to(data.roomId).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });

    socket.on('disconnect', () => {
        console.log('Spirit vanished:', socket.id);
        // This helps the server forget the old device so the new one can connect cleanly
    });
});

const PORT = process.env.PORT || 3000; // Use the environment port or 3000
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});