const express = require('express');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const options = {
    key: fs.readFileSync('./localhost.key'),
    cert: fs.readFileSync('./localhost.crt')
};

const server = https.createServer(options, app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('join', async (roomId) => {
        await socket.join(roomId);
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size === 2) {
            socket.to(roomId).emit('peer-joined', socket.id);
        }
    });

    // Relay motion data from phone to desktop through the server.
    // This bypasses WebRTC/TURN entirely and works on any network since
    // both devices are already connected to this server via socket.io.
    socket.on('motion', (data) => {
        socket.to(data.roomId).emit('motion', data);
    });

    socket.on('signal', (data) => {
        if (data.to) {
            io.to(data.to).emit('signal', { signal: data.signal, from: socket.id });
        } else if (data.roomId) {
            socket.to(data.roomId).emit('signal', { signal: data.signal, from: socket.id });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                localIp = net.address;
            }
        }
    }
    console.log(`OUIJA SERVER IS LIVE`);
    console.log(`https://${localIp}:${PORT}`);
});