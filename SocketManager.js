let io = require('./index2.js').io;

console.log(io);

let connectedSockets = {};

let initSocket = (socket) => {
	console.log("Socket ID: " + socket.id);

	

	socket.on('USERNAME_UPDATED', (username) => {
		console.log('USERNAME_UPDATED');
		connectedSockets[username] = socket;
	});

	socket.on('disconnect', () => {
		console.log('socket disconnected');
	});
}

let getSocketForUser = (username) => {
	console.log('getting socket that ' + username + ' is connected with');
	
	return connectedSockets[username];
}

module.exports = {
	initSocket,
	connectedSockets,
	getSocketForUser
}