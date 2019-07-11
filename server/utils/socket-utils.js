let emitNewChannel = (req, channel) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	console.log(channel);
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

	console.log(sid);
	
	ws.to(sid).emit('remove-listener', listener);
}

let emitBecomeGold = (req) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('become-gold', {});
}

let emitRemoveGold = (req) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('remove-gold', {});
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

module.exports = {
	emitNewChannel,
	emitNewListener,
	emitUpdateListener,
	emitRemoveListener,
	emitBecomeGold,
	emitRemoveGold,
	emitAwardedAchievement,
	emitAwardedAchievementNonMember,
	emitTestListener
}