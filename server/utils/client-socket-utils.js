const Channel = require('../models/channel-model');
const User = require('../models/user-model');
const Notice = require('../models/notice-model');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);

let SearchChannels = (socket, value) => {
	let regex = new RegExp(value, 'gi');
	
	Channel.find({ owner: regex }).sort({'_id': -1}).limit(25).exec((err, docs) => {

		let results = docs.map((doc) => {
			return {
				owner: doc.owner,
				logo: doc.logo
			}
		});
		
		socket.emit('channel-results', results);
	});
}

let SearchMembers = (socket, data) => {
	let regex = new RegExp(data.value, 'gi');

	Channel.findOne({owner: data.owner}).then(foundChannel => {
		if(foundChannel) {
			User.find({'_id': { $in: foundChannel.members}, name: regex}).sort({'_id': -1}).limit(25).exec((err, docs) => {
				//Filter out member data: name, logo, achievements

				let resMembers = docs.map(member => {

					let channelIndex = member.channels.findIndex(channel => (channel.channelID === foundChannel.id));
					let achievements = member.channels[channelIndex].achievements;

					let achIndex = achievements.findIndex(achievement => (achievement.aid === data.aid));

					return {
						name: member.name,
						logo: member.logo,
						earned: achIndex >= 0
					}
				});

				socket.emit('members-retrieved', resMembers);
			});
		}
	})
}

let SearchMembersDetailed = (socket, data) => {
	let regex = new RegExp(data.value, 'gi');

	Channel.findOne({owner: data.owner}).then(foundChannel => {
		if(foundChannel) {
			User.find({'_id': { $in: foundChannel.members}, name: regex}).sort({'_id': -1}).limit(25).exec((err, docs) => {
				//Filter out member data: name, logo, achievements

				let resMembers = docs.map(member => {

					let channelIndex = member.channels.findIndex(channel => (channel.channelID === foundChannel.id));
					let achievements = member.channels[channelIndex].achievements.map((achievement => achievement.aid));

					return {
						name: member.name,
						logo: member.logo,
						achievements: achievements,
						banned: member.channels[channelIndex].banned || false
					}
				});

				socket.emit('member-results', resMembers);
			});
		}
	})
}

let SearchMod = (socket, data) => {
	let regex = new RegExp(data.value, 'gi');
	
	Channel.findOne({owner: data.owner}).then(foundChannel => {
		if(foundChannel) {
			User.find({'_id': { $in: foundChannel.members}, name: regex}).sort({'_id': -1}).limit(25).exec((err, docs) => {
				
				let resMembers = docs.map(member => {

					let modIdx = foundChannel.moderators.findIndex(mod => mod.uid === member.id);

					return {
						name: member.name,
						logo: member.logo,
						isMod: modIdx >= 0
					}
				});

				socket.emit('members-retrieved', resMembers);
			});
		}
	})
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

let MarkNotificationRead = (socket, data) => {
	if(data.notification) {
		Notice.findById(data.notification.id).then(notification => {
			notification.status = 'read';
			notification.save().then(savedNotification => {
				socket.emit('notification-read', savedNotification.id);
			});
		});
	} else if(data.nid) {
		let uid = cryptr.decrypt(data.nid);

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
	searchMembers: SearchMembers,
	searchMembersDetailed: SearchMembersDetailed,
	searchMod: SearchMod,
	storeSocket: StoreSocket,
	removeSocket: RemoveSocket,
	markNotificationRead: MarkNotificationRead,
	deleteNotification: DeleteNotification
}