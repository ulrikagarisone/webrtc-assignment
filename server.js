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
    socket.on('signal', (data) => {
        socket.to(data.roomId).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Go to: http://localhost:${PORT}/desktop.html`));