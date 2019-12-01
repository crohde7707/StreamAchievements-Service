const router = require('express').Router();
const axios = require('axios');
const User = require('../models/user-model');
const Listener = require('../models/listener-model');
const Token = require('../models/token-model');
const Queue = require('../models/queue-model');
const Channel = require('../models/channel-model');
const Notice = require('../models/notice-model');
const Achievement = require('../models/achievement-model');
const Earned = require('../models/earned-model');
const mongoose = require('mongoose');
const {isAdminAuthorized} = require('../utils/auth-utils');
const {emitOverlayAlert} = require('../utils/socket-utils');

router.post('/dedupMembers', isAdminAuthorized, (req, res) => {
	Channel.findOne({owner: 'phirehero'}).then(foundChannel => {
		console.log(foundChannel.members);
		let storedMembers = foundChannel.members;
		console.log(storedMembers);
		let newMemberArray = [];

		User.find({'_id': { $in: storedMembers}}).sort({'name': 1}).exec((err, members) => {
			members.forEach(member => {
				let memberId = storedMembers.splice(storedMembers.indexOf(member.id), 1);

				newMemberArray.push(memberId[0]);
			});

			console.log(newMemberArray);
			console.log(newMemberArray.length);
		});
	});


})

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
					console.log(error);
					console.log('cast issue for ' + entry.channelID);
				}
			})
		} else {
			console.log('nothing in queue');
		}
	});
})

router.post('/fixpreferences', isAdminAuthorized, (req, res) => {
	Channel.find({}).then(channels => {
		if(channels) {
			channels.forEach(channel => {
				channel.overlay = {
					chat: true,
					chatMessage: "{user} just earned the {achievement} achievement! PogChamp",
					sfx: "https://streamachievements.com/sounds/achievement.001.mp3",
					enterEffect: "zoomIn",
					exitEffect: "zoomOut",
					duration: 6,
					volume: 100,
					delay: 2
				}

				channel.save().then(savedChannel => {
					console.log('updated ' + savedChannel.owner + '\'s channel overlay');
				});
			});
		}
	});
});

router.post('/overlay', isAdminAuthorized, (req, res) => {
	emitOverlayAlert(req, {
		user: req.user.name,
		channel: req.user.name,
		title: 'I can show you the world',
		icon: 'https://res.cloudinary.com/phirehero/image/upload/v1562881653/u9astg4olsdtfm2rjhxu.png',
		unlocked: true
	});
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

router.post('/alertSync', isAdminAuthorized, (req, res) => {
	Achievement.find({}).then(achievements => {
		if(achievements) {
			achievements.forEach(achievement => {
				achievement.alert = true;

				achievement.save()
			});
		}
	});
});

router.post('/testTable', isAdminAuthorized, (req, res) => {
	Earned.find({channelID: "5d068493b87afc2f80cf21d5", achievementID: 12}).limit(1).exec((err, earnedDocs) => {
		console.log(earnedDocs);
	});
	// let earnedObj = {
	// 	userID: 70967393,
	// 	channelID: "5d068493b87afc2f80cf21d5",
	// 	achievementID: 11
	// };

	// Earned.findOneAndUpdate(earnedObj, {earned: Date.now(), first: false}, {upsert: true, new: true}).then(earnedDoc => {
	// 	console.log(earnedDoc);
	// });
})

router.post('/notice', isAdminAuthorized, (req, res) => {
	new Notice({
		user: "5cfc5f04a33c32ad539abe0c",
		logo: "https://static-cdn.jtvnw.net/jtv_user_pictures/thorlar-profile_image-4bd4d7b82e71afc3-300x300.jpeg",
		message: "You earned the \"Noisy Viking\" Achievement!",
		date: Date.now()
	}).save().then(savedNotice => {
		console.log(savedNotice);
		res.json(savedNotice);
	});
})

router.post('/tier2', isAdminAuthorized, (req, res) => {
	axios({
		method: 'post',
		url: '/api/achievement/listeners',
		data: [{
			'channel': 'phirehero',
			'achievementID': '5d7661fa447cce56ece85ef8',
			'tier': '2000',
			'userID': '448669568'
		}]
	});
});


router.post('/migrate', isAdminAuthorized, (req, res) => {
	handleMigrate();
});

async function handleMigrate() {
	let totalUserCount = 0;
	let offset = 0;
	let limit = 25;
	let i;

	let users;

	totalUserCount = await User.countDocuments();
		

	console.log("Migrating data for " + totalUserCount + " members...");

	while (offset < totalUserCount) {
		i = 0;

		console.log('\n\nMigrating ' + offset + ' - ' + (offset + limit - 1) + '...\n');
		users = await User.find().sort({'_id': -1}).skip(offset).limit(limit).exec();

		await asyncForEach(users, async (user) => {
			let channels = user.channels;
			console.log('> Migrating ' + channels.length + ' channels for ' + user.name) + '...';

			await asyncForEach(channels, async (channel) => {
				let achievements = channel.achievements;
				let earnedCreated = 0;
				console.log('  > ' + achievements.length + ' achievements found for channel: ' + channel.channelID);

				//TODO: Call for all achievements, add ones that don't exist

				await asyncForEach(achievements, async (achievement) => {
					try {
						let earned = await addEarned(user, channel, achievement);
						console.log('    > Migrated ' + achievement.aid + '!');
						earnedCreated = earnedCreated + 1;
					} catch (err) {
						console.log(err);
						console.log('\x1b[31m    (!) Error occurred migrating entry. achievementID: ' + achievement.aid + ', channelID: ' + channel.channelID + '\x1b[0m');
					}
				})

				if(earnedCreated === achievements.length) {
					console.log('\x1b[32m    > Migrated achievements successfully for channelID: ' + channel.channelID + '\x1b[0m');
				} else {
					console.log('\x1b[33m    > Not all achievements migrated successfully for channelID: ' + channel.channelID + '! Count awarded: ' + earnedCreated + '\x1b[0m');
				}
			})
		});

		offset = offset + limit;
	}
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

async function addEarned(user, channel, achievement) {

	return new Promise((resolve, reject) => {
		let earnedObj = {
			userID: user._id,
			channelID: channel.channelID,
			achievementID: achievement.aid
		};


		asyncSleep().then(async () => {
			let existing = await Earned.findOne(earnedObj);

			if(!existing) {
				console.log('not there');
				earnedObj.earned = achievement.earned;

				console.log(earnedObj);

				new Earned(earnedObj).save().then((savedEarned) => {
					resolve(savedEarned);
				})
			} else {
				console.log('entry exists in table');
				resolve();
			}
		});
		
	});
}

function asyncSleep() {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, 500);
	});
}

module.exports = router;