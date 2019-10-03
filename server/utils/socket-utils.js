let emitNewChannel = (req, channel) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');

	ws.to(sid).emit('new-channel', {
		name: channel.name,
		'full-access': channel['full-access'],
		connected: false
	});
}

let emitNewListener = (req, listener) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('new-listener', listener);
}

let emitUpdateListener = (req, listener) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('update-listener', listener);
}

let emitRemoveListener = (req, listener) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('remove-listener', listener);
}

let emitBecomeGold = (req, channel) => {
	console.log(channel + ' is becoming gold');
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('become-gold', channel);
}

let emitRemoveGold = (req, channel) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('remove-gold', channel);
}

let emitAwardedAchievement = (req, achievement) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');

	ws.to(sid).emit('achievement-awarded', achievement);
}

let emitAwardedAchievementNonMember = (req, achievement) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');

	ws.to(sid).emit('achievement-awarded-nonMember', achievement);
}

let emitTestListener = (req, data) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	ws.to(sid).emit('test', data);
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

module.exports = {
	emitNewChannel,
	emitNewListener,
	emitUpdateListener,
	emitRemoveListener,
	emitBecomeGold,
	emitRemoveGold,
	emitAwardedAchievement,
	emitAwardedAchievementNonMember,
	emitTestListener,
	emitOverlayAlert,
	emitOverlaySettingsUpdate,
	emitNotificationsUpdate
}