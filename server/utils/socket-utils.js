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

let emitPlatforms = (req, event, data, platforms) => {
	let ws, sid;

	platforms.forEach(platform => {
		switch(platform) {
			case 'twitch':
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

		if(ws && sid && data) {
			ws.to(sid).emit(event, data);
		}
	});
}

let emitNewChannel = (req, channel, platforms) => {

	platforms.forEach(platform => {
		emitPlatforms(req, 'new-channel', channel[platform], [platform]);
	});

	//emitPlatforms(req, 'new-channel', channel, platforms)
}

let emitDeleteChannel = (req, identity, platforms) => {
	emitPlatforms(req, 'delete-channel', identity, platforms);
}

let emitChannelUpdate = (req, channelUpdates) => {
	emitPlatforms(req, 'channel-update', channelUpdates, platforms);
}

let emitNewListener = (req, listener, platforms) => {
	emitPlatforms(req, 'new-listener', listener, platforms);
}

let emitUpdateListener = (req, listener, platforms) => {
	emitPlatforms(req, 'update-listener', listener, platforms);
}

let emitRemoveListener = (req, listener, platforms) => {
	emitPlatforms(req, 'remove-listener', listener, platforms);
}

let emitBecomeGold = (req, channel, platforms) => {
	emitPlatforms(req, 'become-gold', channel, platforms);
}

let emitRemoveGold = (req, channel, platforms) => {
	emitPlatforms(req, 'remove-gold', channel, platforms);
}

let emitConnectBot = (req, channelData, platforms) => {
	emitPlatforms(req, 'connect-bot', channelData, platforms);
}

let emitDisconnectBot = (req, channelData, platforms) => {
	emitPlatforms(req, 'disconnect-bot', channelData, platforms);	
}

let emitAwardedAchievement = (req, achievement, platforms) => {
	emitPlatforms(req, 'achievement-awarded', achievement, platforms);
}

let emitAwardedAchievementNonMember = (req, achievement, platforms) => {
	emitPlatforms(req, 'achievement-awarded-nonMember', achievement, platforms);
}

let emitTestListener = (req, data, platforms) => {
	emitPlatforms(req, 'test', data, platforms);
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