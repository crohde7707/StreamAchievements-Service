const router = require('express').Router();
const User = require('../models/user-model');
const Listener = require('../models/listener-model');
const Token = require('../models/token-model');
const mongoose = require('mongoose');

router.get('/channels', (req, res) => {
	let offset = parseInt(req.query.offset) || 0;
	let limit = parseInt(req.query.limit) || 50;
	let total = parseInt(req.query.total) || undefined;

	if(!total) {
		total = User.estimatedDocumentCount().exec().then(count => {
			total = count;
			
			getChannels(offset, limit, total).then(channels => {
				if(channels.err) {
					res.status(500);
					res.json({
						channels: [],
						err: channels.err
					});
				} else {
					res.json(channels);
				}
			});
		});
	} else {
		getChannels(offset, limit, total).then(channels => {
			if(channels.err) {
				res.status(500);
				res.json({
					channels: [],
					err: channels.err
				});
			} else {
				res.json(channels);
			}
		});
	}
});

router.get('/listeners', (req, res) => {
	//pagination: limit, start
	//Find all listeners, and return back the limit, + handle offset of data if there is more
	let offset = parseInt(req.query.offset) || 0;
	let limit = parseInt(req.query.limit) || 50;
	let total = parseInt(req.query.total) || undefined;

	if(!total) {
		//get total count
		total = Listener.estimatedDocumentCount().exec().then(count => {
			total = count;

			getListeners(offset, limit, total).then(listeners => {

				if(listeners.err) {
					res.status(500);
					res.json({
						listeners: [],
						error: listeners.err
					});
				} else {
					console.log(listeners);
					res.json(listeners);
				}
			});
		});
	} else {
		getListeners(offset, limit, total).then(listeners => {

			if(listeners.err) {
				res.status(500);
				res.json({
					listeners: [],
					error: listeners.err
				});
			} else {
				res.json(listeners);
			}
		});
	}

});

let getListeners = (offset, limit, total) => {
	return new Promise((resolve, reject) => {
		Listener.find().sort({'_id': -1}).skip(offset).limit(limit).exec((err, doc) => {
			if(err) {
				resolve({err: 'Issue retrieving from Listener sets'});
			} else {
				let listeners = doc.map(listener => {
					return {
						channel: listener.channel,
						achievement: listener.achievement,
						achType: listener.achType,
						resubType: listener.resubType,
						query: listener.query,
						bot: listener.bot,
						condition: listener.condition
					}
				});

				let response = {
					listeners: listeners,
					total: total
				}
				
				if(listeners.length === limit) {
					response.offset = offset + listeners.length;
				}

				resolve(response);
			}
		});
	});
}

let getChannels = (offset, limit, total) => {
	return new Promise((resolve, reject) => {
		User.find({ $or: [{type: 'verified'},{type:'admin'}]}).sort({'_id': -1}).skip(offset).limit(limit).exec((err, doc) => {
			if(err) {
				resolve({err: 'Issue retrieving from User sets'});
			} else {
				let channels = doc.map(user => {
					let channel = {
						name: user.name,
						full_access: false
					};

					let patreon = user.integration.patreon;

					if(patreon) {
						if(patreon.forever || patreon.is_gold) {
							channel['full-access'] = true;
						}
					}

					return channel;
				});

				let response = {
					channels: channels,
					total: total
				}
				
				if(channels.length === limit) {
					response.offset = offset + channels.length;
				}

				resolve(response);
			}
		});
	});
}

module.exports = router;