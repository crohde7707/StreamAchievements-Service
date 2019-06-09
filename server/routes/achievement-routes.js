const router = require('express').Router();
const passport = require('passport');

const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Queue = require('../models/queue-model');
const Notice = require('../models/notice-model');
const Image = require('../models/image-model');
const {isAuthorized} = require('../utils/auth-utils');

const uploadImage = require('../utils/image-utils').uploadImage;
const mongoose = require('mongoose');

//let io = require('../index2').WebSockets;
//let getSocketForUser = require('../SocketManager').getSocketForUser;

let combineAchievementAndListeners = (achievement, listener) => {
	let merge = {
		"_id": achievement['_id'],
		channel: achievement.owner,
		title: achievement.title,
		description: achievement.description,
		icon: achievement.icon,
		earnable: achievement.earnable,
		limited: achievement.limited,
		secret: achievement.secret,
		listener: achievement.listener,
		code: listener.code
	}
	
	if(listener.resubType) {
		merge.resubType = listener.resubType;
	}
	if(listener.query) {
		merge.query = listener.query;
	}

	return merge;
}

let updatedAchievement = (existingAchievement, updates, listenerUpdates, iconImg) => {
	return new Promise((resolve, reject) => {

		let imgPromise;

		if(iconImg) {
			//New image has been uploaded
			imgPromise = new Promise((innerResolve, innerReject) => {
				Image.findOne({achievementID: existingAchievement._id}).then(existingImg => {
					if(existingImg) {
						existingImg.achievementID = "";
						existingImg.save().then(() => {
							iconImg.achievementID = existingAchievement._id;
							iconImg.save().then(savedImg => {
								innerResolve();
							});
						});	
					} else {
						iconImg.achievementID = existingAchievement._id;
						iconImg.save().then(savedImg => {
							innerResolve();
						});
					}
					
				});

				
			});
		} else {
			imgPromise = Promise.resolve();
		}

		imgPromise.then(() => {
			Achievement.findOneAndUpdate({ _id: existingAchievement._id }, { $set: updates }, {new:true}).then((updatedAchievement) => {
				if(Object.keys(listenerUpdates).length > 0) {
					Listener.findOneAndUpdate({ _id: updatedAchievement.listener }, { $set: listenerUpdates }, { new: true }).then((updatedListener) => {

						let merge = combineAchievementAndListeners(updatedAchievement, updatedListener);

						resolve({
							update: true,
							achievement: merge
						});
					});
				} else {
					Listener.findOne({ _id: updatedAchievement.listener }).then(foundListener => {
						let merge = combineAchievementAndListeners(updatedAchievement, foundListener);

						resolve({
							update: true,
							achievement: merge
						});
					});
				}
			});
		});
	});
}

let retrieveImages = (owner) => {
	return new Promise((resolve, reject) => {
		Image.find({channel: owner, type: "achievement"}).then(foundImages => {
			if(foundImages) {

				let images = {
					active: [],
					inactive: []
				};

				foundImages.map(image => {
					if(image.achievementID && image.achievementID !== "") {
						images.active.push(image);
					} else {
						images.inactive.push(image);
					}
				})

				resolve(images.active.concat(images.inactive));
			} else {
				resolve([]);
			}
		});
	});
}

router.post('/update', isAuthorized, (req, res) => {
	
	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		if(existingChannel) {
			
			Achievement.findOne({['_id']: req.body.id, channel: existingChannel.owner}).then((existingAchievement) => {
				if(existingAchievement) {
					let updates = req.body;

					let {code, resubType, query, bot, condition} = updates;

					let listenerUpdates = {};

					if(code) {
						listenerUpdates.code = code;
						delete updates.code;
					}
					if(resubType) {
						listenerUpdates.resubType = resubType;
						delete updates.resubType;
					}
					if(query) {
						listenerUpdates.query = query;
						delete updates.query;
					}
					if(bot) {
						listenerUpdates.bot = bot;
						delete updates.bot;
					}
					if(condition) {
						listenerUpdates.condition = condition;
						delete updates.condition;
					}

					//If new image, upload it
					if(updates.icon && updates.iconName) {
						uploadImage(updates.icon, updates.iconName, existingChannel.owner).then(iconImg => {
							updates.icon = iconImg.url;

							updatedAchievement(existingAchievement, updates, listenerUpdates, iconImg).then(response => {
								res.json(response);
							});
						});
					} else {
						updatedAchievement(existingAchievement, updates, listenerUpdates).then(response => {
							res.json(response);
						});
					}

				} else {
					res.json({
						update: false,
						message: "The achievement you tried to update doesn't exist!"
					});
				}
			});
		} else {
			res.json({
				update: false,
				message: "The channel you tried to update the achievement for doesn't exist!"
			});
		}
	});
});

router.post("/create", isAuthorized, (req, res) => {
	
	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		if(existingChannel) {
			let query = {};

			if(req.body.id) {
				query['_id'] = req.body.id
			} else {
				query.title = req.body.title
			}

			query.channel = existingChannel.owner

			Achievement.findOne(query).then((existingAchievement) => {
				if(existingAchievement) {
					res.json({
						created: false,
						message: "An achievement with this name already exists!",
						achievement: existingAchievement
					});
				} else {
					Achievement.count().then(count => {
						let achData = {
							uid: count + 1,
							channel: existingChannel.owner,
							title: req.body.title,
							description: req.body.description,
							icon: req.body.icon,
							earnable: req.body.earnable,
							limited: req.body.limited,
							secret: req.body.secret,
							listener: req.body.listener
						};

						let listenerData = {
							channel: existingChannel.owner,
							code: req.body.code
						};

						if(listenerData.code !== '0') {
							listenerData.query = req.body.query;

							if(listenerData.code === "1") {
								listenerData.resubType = parseInt(req.body.resubType);
							}
							if(listenerData.code === "4") {
								listenerData.bot = req.body.bot;
								listenerData.condition = req.body.condition;
							}
						}				

						Listener.findOne(listenerData).then(foundListener => {
							if(foundListener) {
								Achievement.findOne({listener: foundListener._id}).then(foundAchievement => {
									res.json({
										created: false,
										message: "The conditions you selected are already taken by the \"" + foundAchievement.title + "\" achievement!"
									});
								});
							} else {
								if(req.body.icon) {
									uploadImage(req.body.icon, req.body.iconName, existingChannel.owner).then((result) => {
										achData.icon = result.url;
										new Achievement(achData).save().then((newAchievement) => {
											console.log('new achievement in DB');
											listenerData.achievement = newAchievement.id;
											//create listener for achievement
											new Listener(listenerData).save().then(newListener => {
												console.log("new listener in DB");

												newAchievement.listener = newListener.id;
												newAchievement.save().then(updatedAchievement => {
													result.achievementID = updatedAchievement.id;
													result.save().then(updateImage => {
														res.json({
															created: true,
															achievement: updatedAchievement
														});		
													});
												});
											});
										});
									});	
								} else {
									new Achievement(achData).save().then((newAchievement) => {
										console.log('new achievement in DB');
										listenerData.achievement = newAchievement.id;
										//create listener for achievement
										new Listener(listenerData).save().then(newListener => {
											console.log("new listener in DB");

											newAchievement.listener = newListener.id;
											newAchievement.save().then(updatedAchievement => {
												res.json({
													created: true,
													achievement: updatedAchievement
												});
											});
										});
									});
								}
								
							}
						});	
					});
				}
			});	
		} else {
			res.json({
				created: false,
				message: "This channel you are creating for doesn't exist!"
			});
		}	
	});
});

router.post("/delete", isAuthorized, (req, res) => {

	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		if(existingChannel) {
			
			//Check if achievement of same name exists
			let query = {};
			query['_id'] = req.body.achievementID;
			query.channel = existingChannel.owner;

			Achievement.findOne(query).then((existingAchievement) => {
				if(existingAchievement) {
					//time to delete
					let listenerID = existingAchievement.listener;

					Achievement.deleteOne(query).then(err => {
						let listenerQuery = {
							"_id": listenerID,
							channel: existingAchievement.channel
						};

						Listener.findOne(listenerQuery).then(existingListener => {
							if(existingListener) {
								Listener.deleteOne(listenerQuery).then(err => {
									res.json({
										deleted:true
									});
								});
							} else {
								res.json({
									deleted:true
								});
							}
						});
					});

				} else {
					res.json({
						deleted: false,
						message: "The achievement you requested to delete doesn't exist!"
					})
				}
			});
		} else {
			res.json({
				delete: false,
				message: "This channel you are deleting for doesn't exist!"
			});
		}
	});
});

router.get("/retrieve", isAuthorized, (req, res) => {
	let channel = req.user.name;
	let achievement = req.query.aid;

	if(achievement) {
		Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
			if(existingChannel) {
				let achievementPromise = new Promise((resolve, reject) => {
					Achievement.findOne({
						uid: achievement,
						channel: existingChannel.owner
					}).then(existingAchievement => {
						if(existingAchievement) {
							let listenerID = existingAchievement.listener;
							Listener.findOne({
								"_id": existingAchievement.listener,
								channel: existingAchievement.channel
							}).then(existingListener => {
								if(existingListener) {
									let listenerData = Object.assign({}, existingListener['_doc']);
									let achievementData = Object.assign({}, existingAchievement['_doc']);

									delete listenerData._id;

									let mergedAchievement = Object.assign(achievementData, listenerData);

									resolve(mergedAchievement);
								} else {
									resolve(existingAchievement);
								}
							});
						} else {
							resolve(null);
						}
					});
				});

				let imagePromise = retrieveImages(existingChannel.owner);

				Promise.all([achievementPromise, imagePromise]).then(responses => {
					res.json({
						achievement: responses[0],
						images: responses[1],
						defaultIcons: existingChannel.icons
					});
				});
			} else {
				//Current user isn't verified
				res.json({
					error: "User isn't a verified channel owner"
				})
			}
		});

	} else if(channel) {
		Achievement.find({channel: channel}).then((achievements) => { 
			if(achievements) {
				let listenerIds = achievements.map(achievement => {
					return achievement.listener
				});

				Listener.find({'_id': { $in: listenerIds}}).then((listeners) => {
					achievements.forEach(achievement => {
						let listenerData = listeners.find(listener => listener._id = achievement.listener);

						delete listenerData._id;

						return Object.assign(achievement, listenerData);
					});

					res.json(achievements);
				});
			} else {
				res.json(achievements);	
			}
		});
	} else {

	}

});

router.post('/award', isAuthorized, (req, res) => {
	let members = req.body.members;
	let achievementID = req.body.aid;

	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		User.find({'name': { $in: members}}).then(foundMembers => {

			let promises = foundMembers.map((member, idx) => {
				let channels = member.channels;
				let channelIdx = channels.findIndex(channel => channel.channelID === existingChannel.id);

				channels[channelIdx].achievements.push({aid: achievementID, earned: Date.now()});
				member.channels = channels;
				console.log(member.channels[0].achievements);
				return member.save().then(savedMember => {
					console.log(savedMember.channels[0].achievements);
				});
			});

			// let promises = [];

			// for (let i = 0; i < foundMembers.length; i++) {
			// 	let channels = foundMembers[i].channels;
			// 	let channelIdx = channels.findIndex(channel => channel.channelID === existingChannel.id);

			// 	channels[channelIdx].achievements.push(achievementID);
			// 	foundMembers[i].channels = channels;
			// 	promises.push(foundMembers[i].save());
			// }

			Promise.all(promises).then((responses) => {
				User.find({'_id': { $in: existingChannel.members}}).then((members) => {
					//Filter out member data: name, logo, achievements

					let resMembers = members.map(member => {
						return {
							name: member.name,
							logo: member.logo,
							achievements: member.channels.filter((channel) => (channel.channelID === existingChannel.id))[0].achievements
						}
					});

					res.json({
						members: resMembers
					});
				});
			})
		})
	});
});

router.get('/icons', isAuthorized, (req, res) => {
	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		if(existingChannel) {
			//Get Images

			retrieveImages(existingChannel.owner).then(images => {
				res.json({
					images: images,
					defaultIcons: existingChannel.icons
				});
			});
		} else {
			res.json({
				error: true
			});
		}
	});
});

router.get('/listeners', (req, res) => {
	console.log('/achievement/listeners');
	let channelArray = req.query.channel;

	if(!Array.isArray(channelArray)) {
		channelArray = channelArray.split(',');
	}

	console.log(channelArray);

	Listener.find({'channel': { $in: channelArray}})
		.then((listeners) => {
			if(listeners.length > 0) {
				res.json(listeners);
			} else {
				res.json([]);
			}
		});
});

router.post('/listeners', (req, res) => {
	//Process achievements
	console.log('achievements to process...');
	console.log(req.body);
	let achievements = req.body;
	let currentDate = new Date();

	achievements.forEach(achievementListener => {
		let {channel, achievement, tier, userID} = achievementListener;

		User.findOne({'integration.twitch.etid': userID}).then((foundUser) => {
			if(foundUser) {
				Channel.find({owner: channel}).then(foundChannel => {
					let entryIdx = foundUser.channels.findIndex(savedChannel => {
						return savedChannel.channelID === foundChannel._id;
					});

					if(entryIdx >= 0) {
						if(!foundUser.channels[entryIdx].achievements.includes(achievement.achievementID)) {
							foundUser.channels[entryIdx].achievements.push({
								id: achievement.achievementID,
								earned: currentDate
							});
						} else {
							res.json({
								message: "This user already earned this achievement!"
							});
						}
					} else {
						foundUser.channels.push({
							channelID: foundChannel._id,
							achievements: [{
								id: achievement.achievementID,
								earned: currentDate
							}]
						});
						foundUser.save().then(savedUser => {

							//Create a notification for the user
							new Notice({
								twitchID: userID,
								channelID: foundChannel._id,
								achievementID: achievement.achievementID
							}).save().then(savedNotice => {

								// let socket = getSocketForUser(savedUser.name);
								// socket.emit('NEW_NOTIFICATION', savedNotice);

								res.json({
									message: "Achievement has been awarded!"
								});
							});
						});
					}
				});
			} else {
				// User doesn't exist yet, so store the event off to award when signed up!
				Channel.find({owner: channel}).then(foundChannel => {	
					new Queue({
						twitchID: userID,
						channelID: foundChannel._id,
						achievementID: achievement.achievementID
					}).save().then(savedQueue => {
						res.json({
							message: "User hasn't signed up yet, but their achievement earning is stored!"
						});
					});
				})
			}
		});
	});

	//Spawn child process to do it?
});

module.exports = router;