const Channel = require('../models/channel-model');

let SearchChannels = (socket, value) => {
	let regex = new RegExp(value, 'gi');
	
	console.log(regex);
	Channel.find({ owner: regex }).sort({'_id': -1}).limit(25).exec((err, docs) => {
		console.log(err);
		let results = docs.map((doc) => {
			return {
				owner: doc.owner,
				logo: doc.logo
			}
		});
		console.log(results);
		
		socket.emit('channel-results', results);
	});
}

let StoreSocket = (socket, app) => {
	Channel.findOne({oid: socket.handshake.query.uid}).then(foundChannel => {
		if(foundChannel) {
			app.set(foundChannel.owner + "-OVERLAY", socket.id);
			console.log(foundChannel.owner + "-OVERLAY", socket.id);
		} else {
			//No channel found
			socket.emit('connect-issue', "Issue while connecting");
		}
	})
}

module.exports = {
	searchChannels: SearchChannels,
	storeSocket: StoreSocket
}