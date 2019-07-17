const router = require('express').Router();
const User = require('../models/user-model');
const Listener = require('../models/listener-model');
const Token = require('../models/token-model');
const Queue = require('../models/queue-model');
const Achievement = require('../models/achievement-model');
const mongoose = require('mongoose');
const {isAdminAuthorized} = require('../utils/auth-utils');

router.post('/dedup', isAdminAuthorized, (req, res) => {
	User.find({}).then(foundUsers => {
		foundUsers.forEach(user => {
			console.log('dedup for ' + user.name + '...');
			let newUserChannels = [];

			let channels = user.channels;

			channels.forEach(channel => {
				console.log('>>> checking channel: ' + channel.channelID);
				let achievements = channel.achievements;

				console.log(achievements);

				let deduped = achievements.filter((achievement, idx, arr) => {
				    return arr.findIndex((entry) => {
				        return entry.aid === achievement.aid
				    }) === idx;
				});

				if(deduped.length !== achievements.length) {
					console.log('>>>>>> duplicates found: ' + (achievements.length - deduped.length));
				}

				if(deduped.length > 0) {
					console.log('\n');
					console.log(channel);
					console.log('--------------------------------------------');

					let newChannel = {
						...channel['_doc'],
						achievements: deduped
					};

					console.log(newChannel);

					newUserChannels.push(newChannel);
				} else {
					newUserChannels.push(channel);
				}

			});

			user.channels = newUserChannels;

			user.save();
		});
	});
});

router.post('/flush', isAdminAuthorized, (req, res) => {
	Queue.find({}).then(entries => {
		entries.forEach(entry => {
			User.findOne({'integration.twitch.etid': entry.twitchID}).then(foundUser => {
				if(foundUser) {
					let channels = foundUser.channels;
					let channelIdx = channels.findIndex(channel => channel.channelID === entry.channelID);

					if(channelIdx >= 0) {
						let channelAchievements = channels[channelIdx].achievements;
						let found = channelAchievements.filter(ach => {
							ach.aid === entry.achievementID;
						});

						if(!found) {
							channels[channelIdx].achievements.push({
								aid: entry.achievementsID,
								earned: Date.now()
							});

							foundUser.save();
							//delete entry in queue
						} else {
							//delete entry in queue
						}
					}
				}
			});
		})
	})
});

router.post('/fixpreferences', isAdminAuthorized, (req, res) => {
	User.find({}).then(users => {
		if(users) {
			users.forEach(user => {
				if(user.preferences) {
					user.preferences.autojoin = true;	
				} else {
					user.preferences = {
						autojoin: true
					}
				}
				

				user.save();
			});
		}
	});
});

router.post('/sync', isAdminAuthorized, (req, res) => {
	User.find({}).then(users => {
		if(users) {
			users.forEach(user => {
				let newChannels = [];

				let channels = user.channels;

				if(channels) {
					channels.forEach(channel => {
						let newChannel = {
							...channel['_doc'],
							sync: true
						};
						newChannels.push(newChannel);
					});

					user.channels = newChannels;
					user.save();
				}
			});
		}
	});
});

module.exports = router;