const router = require('express').Router();
const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Listener = require('../models/listener-model');
const Token = require('../models/token-model');
const Irc = require('../models/irc-model');
const mongoose = require('mongoose');

router.get('/init', (req, res) => {
	Irc.findOne().then(ircData => {
		if(ircData) {
			res.json({
				at: ircData.at,
				rt: ircData.rt,
				last: ircData.last,
				expires_in: ircData.expires_in
			});
		} else {
			res.json({
				success: false
			})
		}
	});
});

router.put('/init', (req, res) => {
	Irc.findOne().then(ircData => {

		if(ircData) {
			ircData.at = req.body.at;
			ircData.rt = req.body.rt;
			ircData.last = Date.now();
			ircData.expires_in = req.body.expires_in;

			ircData.save().then(savedIRC => {
				res.json({
					success: true
				});
			})
		} else {
			new Irc({
				at: req.body.at,
				rt: req.body.rt,
				last: Date.now(),
				expires_in: req.body.expires_in
			}).save().then(savedIRC => {
				res.json({
					success: true
				});
			})
		}
	});
})

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
	let channels = req.query.channels;

	if(!total) {
		//get total count
		total = Listener.estimatedDocumentCount().exec().then(count => {
			total = count;

			getListeners(offset, limit, total, channels).then(listeners => {

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
		});
	} else {
		getListeners(offset, limit, total, channels).then(listeners => {

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

let getListeners = (offset, limit, total, channels) => {
	return new Promise((resolve, reject) => {

		let query = {};

		if(channels) {
			query.channel = { '$in': channels}
		}

		Listener.find(query).sort({'_id': -1}).skip(offset).limit(limit).exec((err, doc) => {
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
						condition: listener.condition,
						unlocked: listener.unlocked || false
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
		Channel.find({}).sort({'_id': -1}).skip(offset).limit(limit).exec((err, doc) => {
			if(err) {
				resolve({err: 'Issue retrieving from User sets'});
			} else {
				let channels = doc.map(channelDoc => {
					let channel = {
						name: channelDoc.owner,
						cid: channelDoc.id,
						tid: channelDoc.twitchID,
						'full-access': false
					};

					if(channelDoc.gold) {
						channel['full-access'] = true;
					}

					let {streamlabs, streamelements} = channelDoc.integration;

					if(streamlabs) {
						channel.bot = {
							bot: 'streamlabs',
							st: streamlabs.st
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