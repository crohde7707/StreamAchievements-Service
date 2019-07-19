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

router.post('/fixit', isAdminAuthorized, (req, res) => {
	Achievement.find({}).then(achievements => {
		if(achievements) {
			achievements.forEach(achievement => {
				if(achievement.listener) {
					Listener.findById(achievement.listener).then(foundListener => {
						if(foundListener) {
							console.log('updating: ' + achievement.channel + ": " + achievement.title);
							foundListener.aid = achievement.uid;
							foundListener.achievement = achievement.id;
							foundListener.save();
						}
					});
				}
				
			});
		}
	})
})

router.post('/flush', isAdminAuthorized, (req, res) => {
	Queue.find({}).then(queues => {
		if(queues.length > 0) {
			queues.forEach(entry => {
				try {
					console.log('finding ' + entry.channelID + ' channel');
					Channel.findOne({owner: entry.channelID}).then(foundChannel => {
						if(foundChannel) {
							if(entry && entry.achievementID) {
								console.log(entry.twitchID);
								Achievement.findOne({uid: parseInt(entry.achievementID), channel: foundChannel.owner}).then(foundAchievement => {
									if(foundAchievement) {
										User.findOne({'integration.twitch.etid': entry.twitchID}).then(foundUser => {
											if(foundUser) {
												console.log('we found ' + foundUser.name);
												let channels = foundUser.channels;
												let channelIdx = channels.findIndex(channel => channel.channelID === foundChannel.id);

												if(channelIdx >= 0) {
													let channelAchievements = channels[channelIdx].achievements;

													let found = channelAchievements.filter(ach => {
														ach.aid === foundAchievement.uid;
													});

													if(!found) {
														console.log('achievement will be awarded to ' + foundUser.name);
														foundUser.channels[channelIdx].achievements.push({
															aid: foundAchievement.uid,
															earned: entry.earned || Date.now()
														});

														console.log('deleting entry');
														console.log(entry);
														Queue.deleteOne({ _id: entry.id}).then(err => {
															console.log('deleted count: ' + err.deletedCount)
														});

														foundUser.save();
													} else {
														console.log(foundUser.name + 'already has ' + foundAchievement.title + '. Delete it');
														Queue.deleteOne({ _id: entry.id}).then(err => {
															console.log('deleted count: ' + err.deletedCount)
														});
													}
												} else {
													console.log(foundUser.name + 'hasn\'t joined ' + foundChannel.owner + '\'s channel yet');
												}
											} else {
												console.log('no user');
											}
										});
									} else {
										console.log('no achievement');
									}
								});
							}
						} else {
							console.log('no channel');
						}
					})
				} catch(error) {
					console.log('cast issue for ' + entry.channelID);
				}
			})
		} else {
			console.log('nothing in queue');
		}
	});
})

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

router.post('/purgeachievement', isAdminAuthorized, (req, res) => {
	
})

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