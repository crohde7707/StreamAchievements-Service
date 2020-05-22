let emit = (req, event, data) => {
	let platform = req.cookies._ap;
	let ws, sid;

	switch(platform) {
		case 'twitch':
			console.log('get twitch irc socket');
			ws = req.app.get('ws');
			sid = req.app.get('IRCSOCKET');
			break;
		case 'mixer':
			ws = req.app.get('mws');
			sid = req.app.get('MIXER-IRCSOCKET');
			break;
		default:
			break;
	}
	
	if(ws && sid) {
		ws.to(sid).emit(event, data);
	}
}

let emitNewChannel = (req, channel) => {
	console.log('emitting new channel to IRC bot');
	emit(req, 'new-channel', channel);
}

let emitDeleteChannel = (req, identity, platforms) => {
	let ws, sid;

	platforms.forEach(platform => {
		switch(platform) {
			case 'twitch':
				ws = req.app.get('ws');
				sid = req.app.get('IRCSOCKET');
				data = identity;
				break;
			case 'mixer':
				ws = req.app.get('mws');
				sid = req.app.get('MIXER-IRCSOCKET');
				data = identity;
				break;
			default:
				break;
		}

		if(ws && sid && data) {
			ws.to(sid).emit('delete-channel', data);
		}
	});
}

let emitChannelUpdate = (req, channelUpdates) => {
	emit(req, 'channel-update', channelUpdates);
}

let emitNewListener = (req, listener, platforms) => {

	platforms.forEach(platform => {
		switch(platform) {
			case 'twitch':
				ws = req.app.get('ws');
				sid = req.app.get('IRCSOCKET');
				data = listener;
				break;
			case 'mixer':
				ws = req.app.get('mws');
				sid = req.app.get('MIXER-IRCSOCKET');
				data = listener;
				break;
			default:
				break;
		}

		if(ws && sid && data) {
			ws.to(sid).emit('new-listener', data);
		}	
	});

	//emit(req, 'new-listener', listener);
}

let emitUpdateListener = (req, listener) => {
	emit(req, 'update-listener', listener);
}

let emitRemoveListener = (req, listener) => {
	emit(req, 'remove-listener', listener);
}

let emitBecomeGold = (req, channel) => {
	emit(req, 'become-gold', channel);
}

let emitRemoveGold = (req, channel) => {
	emit(req, 'remove-gold', channel);
}

let emitConnectBot = (req, channelData) => {
	emit(req, 'connect-bot', channelData);
}

let emitDisconnectBot = (req, channelData) => {
	emit(req, 'disconnect-bot', channelData);	
}

let emitAwardedAchievement = (req, achievement) => {
	emit(req, 'achievement-awarded', achievement);
}

let emitAwardedAchievementNonMember = (req, achievement) => {
	emit(req, 'achievement-awarded-nonMember', achievement);
}

let emitTestListener = (req, data) => {
	emit(req, 'test', data);
}

let emitOverlayAlert = (req, data) => {
	let ws = req.app.get('ws');
	let sid = req.app.get(data.channel + '-OVERLAYS');
	
	if(sid) {
		sid.forEach(id => {
			ws.to(id).emit('alert-recieved', data);
		});
	}
}

let emitOverlaySettingsUpdate = (req, data) => {
	let ws = req.app.get('ws');
	let sid = req.app.get(data.channel + '-OVERLAYS');
	if(sid) {
		sid.forEach(id => {
			ws.to(id).emit('update-settings', data.overlay);
		});
	}
}

let emitNotificationsUpdate = (req, data) => {
	let ws = req.app.get('ws');
	let sid = req.app.get(data.user + '-NOTIFICATIONS');
	if(sid) {
		sid.forEach(id => {
			ws.to(id).emit('notification-received', data);
		});
	}
}

let emitExtensionAchievementEarned = (req, data) => {
	let ws = req.app.get('ws');
	let extensionSockets = req.app.get('EXTENSIONSOCKETS');
	if(extensionSockets) {
		let sid = extensionSockets[data.user];
		if(sid) {
			ws.to(sid).emit('achievement-earned', data.aid);
		}
	}
}

module.exports = {
	emitNewChannel,
	emitDeleteChannel,
	emitChannelUpdate,
	emitNewListener,
	emitUpdateListener,
	emitRemoveListener,
	emitBecomeGold,
	emitRemoveGold,
	emitConnectBot,
	emitDisconnectBot,
	emitAwardedAchievement,
	emitAwardedAchievementNonMember,
	emitTestListener,
	emitOverlayAlert,
	emitOverlaySettingsUpdate,
	emitNotificationsUpdate,
	emitExtensionAchievementEarned
}