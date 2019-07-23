const Channel = require('../models/channel-model');

let SearchChannels = (socket, value) => {
	let regex = new RegExp(value, 'gi');
	
	Channel.find({ owner: regex }).sort({'_id': -1}).limit(25).exec((err, docs) => {
		console.log(err);
		let results = docs.map((doc) => {
			return {
				owner: doc.owner,
				logo: doc.logo
			}
		});
		
		socket.emit('channel-results', results);
	});
}

let StoreSocket = (socket, app) => {
	Channel.findOne({oid: socket.handshake.query.uid}).then(foundChannel => {
		if(foundChannel) {
			let sockets = app.get(foundChannel.owner + "-OVERLAYS");
			let socketLookup = app.get('SOCKET-LOOKUP');

			if(!socketLookup) {
				socketLookup = {};
			}

			if(sockets) {
				sockets.push(socket.id);
			} else {
				sockets = [socket.id];
			}
			console.log(foundChannel.owner + '\'s sockets: ' + sockets.join(','));
			app.set(foundChannel.owner + "-OVERLAYS", sockets);
			
			socketLookup[socket.id] = foundChannel.owner;

			app.set('SOCKET-LOOKUP', socketLookup);

		} else {
			//No channel found
			socket.emit('connect-issue', "Issue while connecting");
		}
	});
}

let RemoveSocket = (socket, app) => {
	let socketLookup = app.get('SOCKET-LOOKUP');

	let channel = socketLookup[socket.id];

	let channelSockets = app.get(channel + "-OVERLAYS");

	if(channelSockets) {
		let newSockets = channelSockets.filter(channelSocket => {
			return channelSocket !== socket.id
		});

		console.log(channel.owner + '\'s sockets: ' + newSockets.join(','));

		app.set(channel + '-OVERLAYS', newSockets);
	}

	delete socketLookup[socket.id];
	app.set('SOCKET-LOOKUP', socketLookup);
}

module.exports = {
	searchChannels: SearchChannels,
	storeSocket: StoreSocket,
	removeSocket: RemoveSocket
}