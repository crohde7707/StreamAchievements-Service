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

module.exports = {
	searchChannels: SearchChannels
}