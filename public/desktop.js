const socket = io();
const roomId = Math.random().toString(36).substring(2, 11);
socket.emit('join', roomId);