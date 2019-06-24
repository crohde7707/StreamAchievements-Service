const router = require('express').Router();
const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Token = require('../models/token-model');
const mongoose = require('mongoose');

router.get('/channels', (req, res) => {
	User.find({ $or: [{type: 'verified'},{type:'admin'}]}).then(users => {
		let channels = users.map(user => {
			let channel = {
				name: user.name,
				full_access: false
			};

			let patreon = user.integration.patreon;

			if(patreon) {
				if(patreon.forever || patreon.is_gold) {
					channel.full_access = true;
				}
			}

			return channel;
		});

		console.log(channels);

		res.json({
			channels
		});
	});
});

router.get('/listeners', (req, res) => {
	//pagination: limit, start
	//Find all listeners, and return back the limit, + handle offset of data if there is more
	res.json({
		listeners: []
	});
});

module.exports = router;