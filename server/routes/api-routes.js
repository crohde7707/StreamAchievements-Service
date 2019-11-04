const router = require('express').Router();
const passport = require('passport');
const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Notice = require('../models/notice-model');
const Achievement = require('../models/achievement-model');
const Earned = require('../models/earned-model');
const Token = require('../models/token-model');
const mongoose = require('mongoose');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);

let channelRoutes = require('./channel-routes');
let achievementRoutes = require('./achievement-routes');
let ircRoutes = require('./irc-routes');
let adminRoutes = require('./admin-routes');
const {isAuthorized, isAdminAuthorized} = require('../utils/auth-utils');
const {emitTestListener, emitNewChannel} = require('../utils/socket-utils');

const notificationLimit = 15;

router.use('/channel', channelRoutes);
router.use('/achievement', achievementRoutes);
router.use('/irc', ircRoutes);
router.use('/admin', adminRoutes);

router.get("/token", passport.authenticate('twitch'), (req, res) => {
    return res.json({ success: true, data: req.user.id });
  });

let timeout = false

router.get('/users', isAdminAuthorized, (req, res) => {
	Token.find({}).then(tokens => {
		let tokenLookup = {};

		let userIDs = tokens.map(token => {
			tokenLookup[token.uid] = token.token;
			return token.uid;
		});

		User.find({'_id': { $in: userIDs}}).then(users => {
			
			let resUsers = users.map(user => {

				return {
					name: user.name,
					logo: user.logo,
					status: ((tokenLookup[user.id] === "not issued")) ? "new" : "pending"
				}
			});

			res.json({
				users: resUsers
			});
		});
	});
});

router.get("/user", isAuthorized, (req, res) => {
	let uid = cryptr.encrypt(req.user._id);
	let patreonInfo, streamlabsInfo;
	let isMod = false;

	setTimeout(() => {
		if(timeout) {
			res.status(500);
			res.json({
				message: 'Internal Server Issue'
			})
		}
	}, 10000)

	//let timeout = true;
	
	
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

	if(req.user.integration.streamlabs) {
		streamlabsInfo = true;
	} else {
		streamlabsInfo = false;
	}

	Notice.countDocuments({user: req.user._id, status: 'new'}).exec().then(count => {
		Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {

			//Check if user moderates for anyone

			Channel.find({'moderators.uid': req.user._id}).then(channels => {
				if(channels) {
					isMod = true;
				}

				timeout = false;
				
				if(existingChannel) {
					res.json({
						username: req.user.name,
						logo: req.user.logo,
						patreon: patreonInfo,
						streamlabs: streamlabsInfo,
						status: 'verified',
						type: req.user.type,
						preferences: req.user.preferences,
						notificationCount: count,
						uid,
						isMod,
						new: req.user.new
					});
				} else {
					let status = 'viewer';
					
					Token.findOne({uid: req.user._id}).then(foundToken => {
						
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
							streamlabs: streamlabsInfo,
							status,
							type: req.user.type,
							preferences: req.user.preferences,
							notificationCount: count,
							uid,
							isMod,
							new: req.user.new
						});
					});
				}

			});

			
		});
	});

});

router.get("/user/catch", isAuthorized, (req, res) => {
	Earned.find({userID: req.user.integration.twitch.etid}).then(foundEarned => {
		if(foundEarned.length > 0) {

			let channels = foundEarned.map(found => found.channelID);
			
			Channel.find({'_id': { $in: channels}}).then(foundChannels => {

				let retChannels = foundChannels.map(channel => {
					return {
						name: channel.owner,
						logo: channel.logo
					}
				})

				let promises = foundEarned.map(earned => {
					return new Promise((resolve, reject) => {
						earned.userID = req.user.id;
						earned.save().then(() => {
							resolve();
						});
					})
				})

				Promise.all(promises).then(() => {
					res.json({
						catch: true,
						channels: retChannels
					});
				})
			});

		} else {
			//No achievements earned
			res.json({
				catch: false,
				channels: []
			});
		}
	});
});

router.post("/user/catch", isAuthorized, (req, res) => {
	req.user.new = false;
	req.user.preferences.autojoin = req.body.autojoin;

	req.user.save().then(savedUser => {
		res.json({});
	});
})

router.get("/profile", isAuthorized, (req, res) => {
	let channelArray = req.user.channels.map(channel => new mongoose.Types.ObjectId(channel.channelID));

	Channel.find({'_id': { $in: channelArray}}).then((channels) => {

		let promises = channels.map(channel => {
			//TODO: Get count from Earned table
			let earnedAchievements = req.user.channels.filter(userChannel => (userChannel.channelID === channel.id));
			let percentage = 0;

			return new Promise((resolve, reject) => {
				Earned.countDocuments({userID: req.user.id, channelID: channel.id}).then(achCount => {
					let percentage = 0;		
					Achievement.countDocuments({channel: channel.owner}).then(count => {

						if(count > 0) {
							percentage = Math.round((achCount / count) * 100);
						}


						resolve({
				     		logo: channel.logo,
				     		owner: channel.owner,
				     		percentage: percentage
				     	});
					});
			    });
			});
		});

		let notificationPromise = new Promise((resolve, reject) => {
			Notice.countDocuments({user: req.user._id}).exec().then(count => {
				Notice.find({user: req.user._id}).sort({'date': -1}).limit(notificationLimit).exec((err, notifications) => {
					if(notifications) {
						let offset = false;

						let mappedNotifications = notifications.map(notice => {
							return {
								id: notice._id,
								logo: notice.logo,
								message: notice.message,
								date: notice.date,
								type: notice.type,
								channel: notice.channel,
								status: notice.status
							}
						});

						if(notificationLimit === mappedNotifications.length) {
							offset = notificationLimit;
						}

						resolve({
							notifications: mappedNotifications,
							next: offset
						});
					} else {
						resolve([]);
					}
				})
			});
		})

		Promise.all(promises).then(responseData => {

			notificationPromise.then(data => {
				if(!req.user.preferences) {
					req.user.preferences = {
						autojoin: false
					};

					req.user.save().then((savedUser) => {
						res.json({
							channels: responseData,
							preferences: savedUser.preferences,
							notifications: data.notifications,
							next: data.next
						});
					});
				} else {
					res.json({
						channels: responseData,
						preferences: req.user.preferences,
						notifications: data.notifications,
						next: data.next
					});
				}
			})
		});
	});
});

router.get('/notifications', isAuthorized, (req, res) => {
	let offset = parseInt(req.query.next);

	Notice.find({user: req.user._id}).sort({'date': -1}).skip(offset).limit(notificationLimit).exec((err, notifications) => {
		if(notifications) {
			let offset = false;

			let mappedNotifications = notifications.map(notice => {
				return {
					id: notice._id,
					logo: notice.logo,
					message: notice.message,
					date: notice.date,
					type: notice.type,
					channel: notice.channel,
					status: notice.status
				}
			});

			if(notificationLimit === mappedNotifications.length) {
				offset = offset + notificationLimit;
			}

			res.json({
				notifications: mappedNotifications,
				next: offset
			});
		} else {
			res.json([]);
		}
	})
});

router.post("/profile/preferences", isAuthorized, (req, res) => {
	let preferences = {...req.user.preferences} || {};

	preferences = {...req.body.preferences};

	req.user.preferences = preferences;

	req.user.save().then(savedUser => {
		res.json(req.user.preferences);
	});
});

router.post("/test", isAdminAuthorized, (req, res) => {
	emitTestListener(req, { 
		type: 'follow',
		for: 'twitch_account',
		message:
		[{ 
			_id: 'cdf271793355b2c542b2bcbb32c35ba7',
		   	id: '462302230',
		  	name: 'arda_celikkanat',
		   	priority: 10 
		}],
		event_id: 'evt_5ed407e33bf25ba5d4a1d96ffcd034de' 
	});

	res.json({});
})

module.exports = router;