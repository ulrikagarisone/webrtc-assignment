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
    socket.on('join', (roomId) => socket.join(roomId));
    socket.on('signal', (data) => {
        socket.to(data.roomId).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });
});

const PORT = process.env.PORT || 3000;
// '0.0.0.0' tells the server to listen to the WHOLE network, not just localhost
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
    console.log(`Open this on Mac: https://${localIp}:${PORT}`);
});