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
const port = process.env.PORT || 3000;
const io = new Server(server);
const clients = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    clients[socket.id] = { id: socket.id };
    console.log('Socket connected', socket.id);

    socket.on('join', (roomId) => {
        socket.join(roomId);
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size === 2) {
            // tell the phone (second joiner) the desktop's socket.id
            const desktopId = [...room][0]; // first person who joined = desktop
            socket.emit('peer-joined', desktopId);
        }
    });

    socket.on('signal', (peerId, signal) => {
        console.log(`Received signal from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('signal', peerId, signal, socket.id);
    });

    socket.on('disconnect', () => {
        delete clients[socket.id];
    });
});

server.listen(port, () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`https://${net.address}:${port}`);
            }
        }
    }
    console.log(`OUIJA SERVER IS LIVE on port ${port}`);
});