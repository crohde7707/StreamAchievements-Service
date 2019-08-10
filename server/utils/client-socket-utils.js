const Channel = require('../models/channel-model');
const User = require('../models/user-model');
const Notice = require('../models/notice-model');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);

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
	if(socket.handshake.query.uid) {
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
				
				socketLookup[socket.id] = {
					name: foundChannel.owner,
					type: 'OVERLAYS'
				}

				app.set('SOCKET-LOOKUP', socketLookup);

			} else {
				//No channel found
				socket.emit('connect-issue', "Issue while connecting");
			}
		});
	} else if(socket.handshake.query.nid) {
		
		let uid = cryptr.decrypt(socket.handshake.query.nid);

		User.findById(uid).then(foundUser => {
			let sockets = app.get(foundUser.name + "-NOTIFICATIONS");
			let socketLookup = app.get('SOCKET-LOOKUP');

			if(!socketLookup) {
				socketLookup = {};
			}

			if(sockets) {
				sockets.push(socket.id);
			} else {
				sockets = [socket.id];
			}
			
			app.set(foundUser.name + "-NOTIFICATIONS", sockets);
			
			socketLookup[socket.id] = {
				name: foundUser.name,
				type: 'NOTIFICATIONS'
			};

			app.set('SOCKET-LOOKUP', socketLookup);
		})
		
	}
}

let RemoveSocket = (socket, app) => {
	let socketLookup = app.get('SOCKET-LOOKUP');

	if(socketLookup) {
		let socketData = socketLookup[socket.id];

		if(socketData) {
			let channelSockets = app.get(`${socketData.name}-${socketData.type}`);

			if(channelSockets) {
				let newSockets = channelSockets.filter(channelSocket => {
					return channelSocket !== socket.id
				});

				app.set(`${socketData.name}-${socketData.type}`, newSockets);
			}

			delete socketLookup[socket.id];
			app.set('SOCKET-LOOKUP', socketLookup);
		}
	}
}

let MarkNotificationRead = (socket, notification) => {
	if(notification.notification) {
		Notice.findById(notification.id).then(notification => {
			notification.status = 'read';
			notification.save().then(savedNotification => {
				socket.emit('notification-read', savedNotification.id);
			});
		});
	} else if(notification.nid) {
		let uid = cryptr.decrypt(notification.nid);

		Notice.find({user: uid}).then(notifications => {
			if(notifications) {
				notifications.forEach(notification => {
					if(notification.status !== 'read') {
						notification.status = "read";
						notification.save()	
					}
				});
				socket.emit('notification-read', 'all');
			}
		});
	}
}

let DeleteNotification = (socket, notification) => {
	Notice.findByIdAndRemove(notification.id).then(notification => {
		socket.emit('notification-removed', notification.id);
	});
	
}

module.exports = {
	searchChannels: SearchChannels,
	storeSocket: StoreSocket,
	removeSocket: RemoveSocket,
	markNotificationRead: MarkNotificationRead,
	deleteNotification: DeleteNotification
}