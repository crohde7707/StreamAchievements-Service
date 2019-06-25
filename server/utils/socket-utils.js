let emitNewChannel = (req, channel) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('new-channel', {
		name: channel.name,
		'full-access': channel['full-access'],
		online: false
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

let emitAchievementAwarded = () => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('achievement-awarded', {});
}

module.exports = {
	emitNewChannel,
	emitNewListener,
	emitUpdateListener,
	emitRemoveListener,
	emitBecomeGold,
	emitRemoveGold,
	emitAchievementAwarded
}