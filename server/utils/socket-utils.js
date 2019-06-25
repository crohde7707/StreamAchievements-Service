let emitNewChannel = (req, channel) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('new-channel', {
		name: channel.name,
		'full-access': channel['full-access'],
		online: false
	});
}

let emitNewListener = (listener) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('new-listener', listener);
}

let emitUpdateListener = (listener) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('update-listener', listener);
}

let emitRemoveListener = (listener) => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');

	console.log(sid);
	
	ws.to(sid).emit('remove-listener', listener);
}

let emitBecomeGold = () => {
	let ws = req.app.get('ws');
	let sid = req.app.get('IRCSOCKET');
	
	ws.to(sid).emit('become-gold', {});
}

let emitRemoveGold = () => {
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