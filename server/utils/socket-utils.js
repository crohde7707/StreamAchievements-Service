let emit = (req, event, data) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');

	ws.to(sid).emit(event, data);
}

let emitNewChannel = (req, channel) => {
	emit(req, 'new-channel', channel);
}

let emitDeleteChannel = (req, channel) => {
	emit(req, 'delete-channel', channel);
}

let emitChannelUpdate = (req, channelUpdates) => {
	emit(req, 'channel-update', channelUpdates);
}

let emitNewListener = (req, listener) => {
	emit(req, 'new-listener', listener);
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
	console.log(data);
	let ws = req.app.get('ws');
	let extensionSockets = req.app.get('EXTENSIONSOCKETS');
	if(extensionSockets) {
		let sid = extensionSockets[data.user];
		console.log(sid);
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