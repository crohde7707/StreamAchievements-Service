const router = require('express').Router();
const passport = require('passport');
const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Token = require('../models/token-model');
const mongoose = require('mongoose');

let channelRoutes = require('./channel-routes');
let achievementRoutes = require('./achievement-routes');
let ircRoutes = require('./irc-routes');
const {isAuthorized, isAdminAuthorized} = require('../utils/auth-utils');
const {emitTestListener, emitNewChannel} = require('../utils/socket-utils');

router.use('/channel', channelRoutes);
router.use('/achievement', achievementRoutes);
router.use('/irc', ircRoutes);

router.get("/token", passport.authenticate('twitch'), (req, res) => {
    return res.json({ success: true, data: req.user.id });
  });

let timeout = false

router.get('/users', isAdminAuthorized, (req, res) => {
	Token.find({}).then(tokens => {
		let userIDs = tokens.map(token => token.uid);
		User.find({'_id': { $in: userIDs}}).then(users => {
			let response = {
				new: [],
				pending: []
			};
			
			let resUsers = users.map(user => {
				return {
					name: user.name,
					logo: user.logo
				}
			});

			res.json({
				users: resUsers
			});
		});
	});
});

router.get("/user", isAuthorized, (req, res) => {

	setTimeout(() => {
		if(timeout) {
			console.log('timeout');
			res.status(500);
			res.json({
				message: 'Internal Server Issue'
			})
		}
	}, 10000)

	//let timeout = true;
	let patreonInfo;
	
	if(req.user.integration.patreon) {

		let patron = req.user.integration.patreon;

		patreonInfo = {
			vanity: patron.vanity,
			thumb_url: patron.thumb_url,
			follower: patron.is_follower,
			status: patron.status,
			gold: patron.is_gold
		}
	} else {
		patreonInfo = false;
	}

	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		timeout = false;
		if(existingChannel) {
			res.json({
				username: req.user.name,
				logo: req.user.logo,
				patreon: patreonInfo,
				status: 'verified',
				type: req.user.type
			});
		} else {
			let status = 'viewer';

			console.log(req.user);
			
			Token.findOne({uid: req.user._id}).then(foundToken => {
				console.log(foundToken);
				if(foundToken) {
					if(foundToken.token === 'not issued') {
						status = 'review'
					} else {
						status = 'pending'
					}
				}

				res.json({
					username: req.user.name,
					logo: req.user.logo,
					patreon: patreonInfo,
					status,
					type: req.user.type
				});
			});
		}
	});

});

router.get("/profile", isAuthorized, (req, res) => {
	let channelArray = req.user.channels.map(channel => new mongoose.Types.ObjectId(channel.channelID));

	Channel.find({'_id': { $in: channelArray}}).then((channels) => {

		let promises = channels.map(channel => {
			let earnedAchievements = req.user.channels.filter(userChannel => (userChannel.channelID === channel.id));
			let percentage = 0;

			return new Promise((resolve, reject) => {
				Achievement.countDocuments({channel: channel.owner}).then(count => {
					if(count > 0) {
						percentage = Math.round((earnedAchievements[0].achievements.length / count) * 100);
					}

					resolve({
			     		logo: channel.logo,
			     		owner: channel.owner,
			     		percentage: percentage
			     	});
			    });
			});
		});

		Promise.all(promises).then(responseData => {
			res.json(responseData);
		});
	});
});

router.post("/test", isAdminAuthorized, (req, res) => {
	// emitTestListener(req, {
	// 	channel: req.body.channel,
	// 	message: req.body.message,
	// 	username: req.body.username
	// });
	emitNewChannel(req, {
		name: req.body.channel,
		'full-access': false
	});
})

module.exports = router;