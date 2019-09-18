const router = require('express').Router();
const passport = require('passport');
const uuid = require('uuid/v1');
const axios = require('axios');

const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Queue = require('../models/queue-model');
const Notice = require('../models/notice-model');
const Image = require('../models/image-model');
const {isAuthorized, isModAuthorized} = require('../utils/auth-utils');
const {
	emitNewListener,
	emitUpdateListener,
	emitRemoveListener,
	emitAwardedAchievement,
	emitAwardedAchievementNonMember,
	emitOverlayAlert,
	emitNotificationsUpdate
} = require('../utils/socket-utils');

const uploadImage = require('../utils/image-utils').uploadImage;
const DEFAULT_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png";
const mongoose = require('mongoose');

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
		achType: listener.achType,
		condition: listener.condition
	}
	
	if(listener.query) {
		merge.query = listener.query;
	}

	return merge;
}

let updateAchievement = (req, channel, existingAchievement, updates, listenerUpdates, iconImg) => {
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
					if(listenerUpdates.achType && listenerUpdates.achType === "3" && updatedAchievement.listener) {
						//updated to manual achievement, delete listener
						Listener.findOne({ _id: updatedAchievement.listener }).then(existingListener => {
							if(existingListener) {

								emitRemoveListener(req, {
									uid: existingListener.uid,
									channel,
									achievement: existingListener.achievement,
									achType: existingListener.achType,
									query: existingListener.query,
									bot: existingListener.bot,
									condition: existingListener.condition
								});

								Listener.deleteOne({ _id : updatedAchievement.listener}).then(err => {
									updatedAchievement.listener = undefined;
									updatedAchievement.save().then(savedAchievement => {

										resolve({
											update: true,
											achievement: savedAchievement
										});
									});
								});
							}
						});
					} else if(listenerUpdates.achType && listenerUpdates.achType !== "3" && !existingAchievement.listener) {
						//Listener didnt exist before, create one now
						let listenerData = {
							channel,
							uid: uuid(),
							...listenerUpdates,
							achievement: updatedAchievement.id,
							aid: updatedAchievement.uid
						};

						new Listener(listenerData).save().then(newListener => {
														
							emitNewListener(req, {
								uid: newListener.uid,
								channel: newListener.channel,
								achievement: newListener.achievement,
								achType: newListener.achType,
								query: newListener.query,
								bot: newListener.bot,
								condition: newListener.condition
							});

							updatedAchievement.listener = newListener.id;
							updatedAchievement.save().then(savedAchievement => {
								resolve({
									created: true,
									achievement: savedAchievement
								});
							});
						});

					} else {

						Listener.findOneAndUpdate({ _id: updatedAchievement.listener }, { $set: listenerUpdates }, { new: true }).then((updatedListener) => {

							if(updatedListener) {
								emitUpdateListener(req, {
									uid: updatedListener.uid,
									channel: channel,
									achievement: updatedListener.achievement,
									achType: updatedListener.achType,
									query: updatedListener.query,
									bot: updatedListener.bot,
									condition: updatedListener.condition
								});

								let merge = combineAchievementAndListeners(updatedAchievement, updatedListener);

								resolve({
									update: true,
									achievement: merge
								});
							} else {
								console.log("issue updating listener for achievement");
								console.log("owner: " + channel);
								console.log("achievement: " + updateAchievement.title);
								resolve({
									update: false
								});
							}
						});
					}
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

					let {achType, query, bot, condition} = updates;

					let listenerUpdates = {};

					if(achType) {
						listenerUpdates.achType = achType;
						delete updates.achType;
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

							updateAchievement(req, existingChannel.owner, existingAchievement, updates, listenerUpdates, iconImg).then(response => {
								res.json(response);
							});
						});
					} else {
						updateAchievement(req, existingChannel.owner, existingAchievement, updates, listenerUpdates).then(response => {
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

					Achievement.countDocuments({channel: existingChannel.owner}).then(preCount => {

						let achData = {
							uid: existingChannel.nextUID,
							channel: existingChannel.owner,
							title: req.body.title,
							description: req.body.description,
							icon: req.body.icon,
							earnable: req.body.earnable,
							limited: req.body.limited,
							secret: req.body.secret,
							listener: req.body.listener,
							order: preCount
						};

						let listenerData = {
							channel: existingChannel.owner,
							achType: req.body.achType,
							uid: uuid()
						};

						listenerData.condition = req.body.condition;

						if(listenerData.achType === "4") {
							listenerData.bot = req.body.bot;
							listenerData.query = req.body.query;
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
											listenerData.achievement = newAchievement.id;
											listenerData.aid = newAchievement.uid;
											
											result.achievementID = newAchievement.id;
											result.save().then(updatedImage => {
												existingChannel.nextUID = newAchievement.uid + 1;
												existingChannel.save().then(updatedChannel => {
													//create listener for achievement
													if(req.body.achType !== "3") {
														new Listener(listenerData).save().then(newListener => {
															
															emitNewListener(req, {
																uid: listenerData.uid,
																channel: listenerData.channel,
																achievement: listenerData.achievement,
																achType: listenerData.achType,
																query: listenerData.query,
																bot: listenerData.bot,
																condition: listenerData.condition
															});

															newAchievement.listener = newListener.id;
															newAchievement.save().then(updatedAchievement => {
																res.json({
																	created: true,
																	achievement: updatedAchievement
																});
															});
														});
													} else {
														res.json({
															created: true,
															achievement: newAchievement
														});
													}
												});
											});
										});
									});	
								} else {
									new Achievement(achData).save().then((newAchievement) => {
										listenerData.achievement = newAchievement.id;
										listenerData.aid = newAchievement.uid;
										
										existingChannel.nextUID = newAchievement.uid + 1;
										existingChannel.save().then(updatedChannel => {
											//create listener for achievement
											if(req.body.achType !== "3") {
												new Listener(listenerData).save().then(newListener => {
													
													emitNewListener(req, {
														uid: listenerData.uid,
														channel: listenerData.channel,
														achievement: listenerData.achievement,
														achType: listenerData.achType,
														query: listenerData.query,
														bot: listenerData.bot,
														condition: listenerData.condition
													});

													newAchievement.listener = newListener.id;
													newAchievement.save().then(updatedAchievement => {
														res.json({
															created: true,
															achievement: updatedAchievement
														});
													});
												});
											} else {
												res.json({
													created: true,
													achievement: newAchievement
												});
											}
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

			Achievement.findOne(query).then(existingAchievement => {
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

								emitRemoveListener(req, {
									uid: existingListener.uid,
									channel: existingChannel.owner,
									achievement: existingListener.achievement,
									achType: existingListener.achType,
									query: existingListener.query,
									bot: existingListener.bot,
									condition: existingListener.condition
								});

								Listener.deleteOne(listenerQuery).then(err => {
									Image.findOneAndUpdate({achievementID: req.body.achievementID}, { $set: {achievementID: ''}}).then(updatedImage => {
										res.json({
											deleted:true
										});
									});
								});
							} else {
								Image.findOneAndUpdate({achievementID: req.body.achievementID}, { $set: {achievementID: ''}}).then(updatedImage => {
									res.json({
										deleted:true
									});
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

router.get("/mod/retrieve", isModAuthorized, (req, res) => {
	let achievement = req.query.aid;

	getAchievementData(req, res, req.channel, achievement);
});

router.get("/retrieve", isAuthorized, (req, res) => {
	let channel = req.user.name;
	let achievement = req.query.aid;

	if(achievement) {
		Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
			if(existingChannel) {
				getAchievementData(req, res, existingChannel, achievement);
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

let getAchievementData = (req, res, existingChannel, achievement) => {
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
}

router.post('/mod/award', isModAuthorized, (req, res) => {
	manualAward(req, res, req.channel);
});

router.post('/award', isAuthorized, (req, res) => {	

	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		manualAward(req, res, existingChannel);
	});
});

let manualAward = (req, res, existingChannel) => {
	let members = req.body.members;
	let achievementID = req.body.aid;

	Achievement.findOne({uid: achievementID, channel: existingChannel.owner}).then(foundAchievement => {
		User.find({'name': { $in: members}}).then(foundMembers => {
			let promises = foundMembers.map((member, idx) => {
				let channels = member.channels;
				let channelIdx = channels.findIndex(channel => channel.channelID === existingChannel.id);

				channels[channelIdx].achievements.push({aid: achievementID, earned: Date.now()});
				member.channels = channels;

				return member.save().then(savedMember => {
					if(existingChannel.overlay.chat) {
						let alertData = {
							'channel':existingChannel.owner,
							'member': savedMember.name,
							'achievement': foundAchievement.title
						};

						emitAwardedAchievement(req, alertData);
					}

					new Notice({
						user: savedMember._id,
						logo: existingChannel.logo,
						message: `You have earned the "${foundAchievement.title}" achievement!`,
						date: Date.now(),
						type: 'achievement',
						channel: existingChannel.owner,
						status: 'new'
					}).save().then(savedNotice => {
						emitNotificationsUpdate(req, {
							notification: {
								id: savedNotice._id,
								logo: savedNotice.logo,
								message: savedNotice.message,
								date: savedNotice.date,
								type: savedNotice.type,
								channel: savedNotice.channel,
								status: savedNotice.status
							},
							user: savedMember.name
						});
					});
					
					let shouldAlert = foundAchievement.alert || true;
					let unlocked = false;

					if(existingChannel.gold) {
						unlocked = true
					}

					if(shouldAlert) {
						emitOverlayAlert(req, {
							user: savedMember.name,
							channel: existingChannel.owner,
							title: foundAchievement.title,
							icon: foundAchievement.icon,
							unlocked
						});	
					}
				});
			});

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
			});
		})
	});
}

router.get('/icons', isAuthorized, (req, res) => {
	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		if(existingChannel) {
			//Get Images

			retrieveImages(existingChannel.owner).then(images => {
				let retImages = images.map(image => {
					let tempImg = {...image['_doc']};
					delete tempImg['__v'];
					delete tempImg['_id'];

					return tempImg;
				});

				res.json({
					images: retImages,
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
	//TODO: Paginate this request
	let channelArray = req.query.channel;

	if(!Array.isArray(channelArray)) {
		channelArray = channelArray.split(',');
	}

	Achievement.find({'owner': { $in: channelArray}})
		.then(achievements => {
			let earnableAchievements = achievements.map(achievement => {
				if(achievement.earnable && achievement.listener) {
					return achievement.listener
				}
			});
		})

	Listener.find({'channel': { $in: channelArray}})
		.then((listeners) => {
			if(listeners.length > 0) {
				res.json(listeners);
			} else {
				res.json([]);
			}
		});
});

router.post('/award/chat', (req, res) => {

	let {achievement, channel, target, user} = req.body;

	let award = false;

	if(achievement && channel && target && user) {

		Channel.findOne({owner: channel}).then(foundChannel => {

			if(foundChannel && foundChannel.gold) {
				if(user === channel) {
					award = true;
				} else {

					let moderatorIds = foundChannel.moderators.map(moderator => moderator.uid);

					User.find({'_id': { $in: moderatorIds}}, 'name').then(moderators => {
						if(moderators) {
							let modIdx = moderators.findIndex(mod => mod.name === user);

							if(modIdx >= 0) {
								award = true;
							}
						}
					})
				}
				
				if(award) {
					
					let achievementCriteria = {
						title: achievement,
						channel: channel
					};

					let userCriteria = {
						name: target.toLowerCase()
					};

					handleAchievement(req, res, foundChannel, achievementCriteria, userCriteria);
				}
			}
		})
	}
});

let alertAchievement = (req, foundChannel, savedUser, foundAchievement) => {
	if(foundChannel.overlay.chat) {
		let alertData = {
			'channel': foundChannel.owner,
			'member': savedUser.name,
			'achievement': foundAchievement.title
		};
		
		emitAwardedAchievement(req, alertData);	
	}
	
	
	let shouldAlert = foundAchievement.alert || true;
	let unlocked = false;

	if(foundChannel.gold) {
		unlocked = true
	}

	if(shouldAlert) {
		emitOverlayAlert(req, {
			user: savedUser.name,
			channel: foundChannel.owner,
			title: foundAchievement.title,
			icon: foundAchievement.icon,
			unlocked
		});	
	}
}

let handleTieredBackfill = (req, tier, foundChannel, userAchievements, savedUser, currentDate, entryIdx, queue) => {
	//handle awarding achievement for tiers (3 gives 3,2,1)

	if(tier && tier !== "1000") {
		let tierCriteria = [];
		
		if(tier === "2000") {
			tierCriteria.push("1000");
		} else if(tier === "3000") {
			tierCriteria.push("1000");
			tierCriteria.push("2000");
		}

		Listener.find({achType: "0", condition: { $in: tierCriteria}, channel: foundChannel.owner}).then(listeners => {

			let achievementsToAward = [];
			
			if(listeners) {

				let achievementPromise = new Promise((resolve, reject) => {
					if(queue) {

						let achIDs = listeners.map(listener => listener.aid);

						console.log(achIDs);

						Queue.find({twitchID: savedUser.userID, name: savedUser.name, channelID: foundChannel._id, achievementID: { $in: achIDs}}).then(foundQueues => {
							console.log(foundQueues);
							if(foundQueues && foundQueues.length > 0) {

								foundQueues.forEach(found => {

									let idx = achIDs.findIndex(ach => ach === found.achievementID);
									if(idx >= 0) {
										achIDs.splice(idx, 1);
									}
								});
							}

							achievementsToAward = achIDs;

							resolve();
						})
					} else {
						listeners.forEach(listener => {
							if(!userAchievements) {
								achievementsToAward.push(listener.aid);
							} else {
								let achIdx = userAchievements.findIndex(usrAch => {
									return usrAch.aid === listener.aid;
								});

								if(achIdx < 0) {
									achievementsToAward.push(listener.aid);
								}
							}
						});	

						resolve();
					}
					
				});

				achievementPromise.then(() => {
					if(achievementsToAward.length > 0) {
						Achievement.find({channel: foundChannel.owner, uid: { $in: achievementsToAward}}).then(tieredAchievements => {
							if(tieredAchievements) {
								if(queue) {

									tieredAchievements.forEach(tierAch => {
										//Hasn't been added to the queue yet, so add it
										new Queue({
											twitchID: savedUser.userID,
											name: savedUser.name,
											channelID: foundChannel._id,
											achievementID: tierAch.uid,
											earned: currentDate
										}).save().then(savedQueue => {
											alertAchievement(req, foundChannel, savedUser, tierAch)
										});
									});
								} else {

									tieredAchievements.forEach(tierAch => {
										savedUser.channels[entryIdx].achievements.push({
											aid: tierAch.uid,
											earned: currentDate
										});

										new Notice({
											user: savedUser._id,
											logo: foundChannel.logo,
											message: `You have earned the "${tierAch.title}" achievement!`,
											date: currentDate,
											type: 'achievement',
											channel: foundChannel.owner,
											status: 'new'
										}).save().then(savedNotice => {
											emitNotificationsUpdate(req, {
												notification: {
													id: savedNotice._id,
													logo: savedNotice.logo,
													message: savedNotice.message,
													date: savedNotice.date,
													type: savedNotice.type,
													channel: savedNotice.channel,
													status: savedNotice.status
												},
												user: savedUser.name
											});

											alertAchievement(req, foundChannel, savedUser, tierAch);
										});
									});

									savedUser.save();
								}
							} else {
								console.log('achievements not found');
							}
						})
					}
				});
			}
		})
	}
}

let handleAchievement = (req, res, foundChannel, achievementCriteria, userCriteria, tier, retry=2) => {
	
	let currentDate = new Date();

	Achievement.findOne(achievementCriteria).then(foundAchievement => {
		if(foundAchievement) {
			if(foundAchievement.earnable) {

				User.findOne(userCriteria).then((foundUser) => {
					if(foundUser) {
						console.log('> User: ' + foundUser.name);

						let entryIdx = foundUser.channels.findIndex(savedChannel => {
							return savedChannel.channelID === foundChannel.id;
						});

						if(entryIdx >= 0) {
							console.log('> ' + foundUser.name + ' is a part of this channel');
							//User already a part of this channel
							let userAchievements = foundUser.channels[entryIdx].achievements;
							let sync = foundUser.channels[entryIdx].sync;

							let achIdx = userAchievements.findIndex(usrAch => {
								return usrAch.aid === foundAchievement.uid;
							});

							if(achIdx < 0) {
								console.log('> ' + foundUser.name + ' doesn\'t have this achievement yet');
								
								try {

									foundUser.channels[entryIdx].achievements.push({
										aid: foundAchievement.uid,
										earned: currentDate
									});

									foundUser.save().then(savedUser => {

										new Notice({
											user: foundUser._id,
											logo: foundChannel.logo,
											message: `You have earned the "${foundAchievement.title}" achievement!`,
											date: currentDate,
											type: 'achievement',
											channel: foundChannel.owner,
											status: 'new'
										}).save().then(savedNotice => {
											emitNotificationsUpdate(req, {
												notification: {
													id: savedNotice._id,
													logo: savedNotice.logo,
													message: savedNotice.message,
													date: savedNotice.date,
													type: savedNotice.type,
													channel: savedNotice.channel,
													status: savedNotice.status
												},
												user: foundUser.name
											});
										});

										handleTieredBackfill(req, tier, foundChannel, userAchievements, savedUser, currentDate, entryIdx);

										if(sync) {
											console.log("syncing for " + savedUser.name);

											handleSubBackfill(req, foundAchievement.id, savedUser, foundChannel, tier);
										}

										alertAchievement(req, foundChannel, savedUser, foundAchievement);
									});
								} catch (err) {
									//Error saving achievement, retry
									if(retry > 0) {
										let remaining = retry - 1;
										handleAchievement(req, res, foundChannel, achievementCriteria, userCriteria, tier, remaining);	
									} else {
										console.log('sending notice');
										console.log(process.env.NOTICE_USER);
										new Notice({
											user: process.env.NOTICE_USER,
											logo: DEFAULT_ICON,
											message: `Issue awarding ${foundChannel.owner}'s '${foundAchievement.title}' to ${foundUser.name}`,
											date: currentDate,
											type: 'admin',
											status: 'new'
										}).save();

										User.findOne({name: foundChannel.owner}).then(foundOwner => {
											new Notice({
												user: foundOwner._id,
												logo: DEFAULT_ICON,
												message: `Issue awarding '${foundAchievement.title}' to ${foundUser.name}! We are looking into the issue, feel free to manually award the achievement!`,
												date: currentDate,
												type: 'admin',
												status: 'new'
											}).save();
										});
									}
								}

							} else {
								//User already has achievement, but reward those past
								handleTieredBackfill(req, tier, foundChannel, userAchievements, foundUser, currentDate, entryIdx);
							}
						} else {
							console.log("couldn't find the channel");
							
							if(foundUser.preferences.autojoin) {
								try {
									foundUser.channels.push({
										channelID: foundChannel.id,
										achievements: [{
											aid: foundAchievement.uid,
											earned: currentDate
										}]
									});
									foundUser.save().then(savedUser => {
										foundChannel.members.push(savedUser.id);
										foundChannel.save().then(savedChannel => {
											
											new Notice({
												user: savedUser._id,
												logo: foundChannel.logo,
												message: `You have earned the "${foundAchievement.title}" achievement!`,
												date: currentDate,
												type: 'achievement',
												channel: foundChannel.owner,
												status: 'new'
											}).save().then(savedNotice => {
												emitNotificationsUpdate(req, {
													notification: {
														id: savedNotice._id,
														logo: savedNotice.logo,
														message: savedNotice.message,
														date: savedNotice.date,
														type: savedNotice.type,
														channel: savedNotice.channel,
														status: savedNotice.status
													},
													user: savedUser.name
												});

												let channelIdx = savedUser.channels.findIndex(savedChannel => {
													return savedChannel.channelID === foundChannel.id;
												});

												handleTieredBackfill(req, tier, foundChannel, false, savedUser, currentDate, channelIdx);

												alertAchievement(req, foundChannel, savedUser, foundAchievement);
											});	
										})
									});
								} catch(err) {
									if(retry > 0) {
										let remaining = retry - 1;
										handleAchievement(req, res, foundChannel, achievementCriteria, userCriteria, tier, remaining);	
									} else {
										new Notice({
											user: process.env.NOTICE_USER,
											logo: DEFAULT_ICON,
											message: `Issue awarding ${foundChannel.owner}'s '${foundAchievement.title}' to ${foundUser.name}`,
											date: currentDate,
											type: 'admin',
											status: 'new'
										}).save();

										User.findOne({name: foundChannel.owner}).then(foundOwner => {
											new Notice({
												user: foundOwner._id,
												logo: DEFAULT_ICON,
												message: `Issue awarding '${foundAchievement.title}' to ${foundUser.name}! We are looking into the issue, feel free to manually award the achievement!`,
												date: currentDate,
												type: 'admin',
												status: 'new'
											}).save();
										});
									}
								}
							} else {
								Queue.findOne({
									name: foundUser.name,
									channelID: foundChannel._id,
									achievementID: foundAchievement.uid
								}).then(foundQueue => {
									if(!foundQueue) {
										new Queue({
											twitchID: foundUser.integration.twitch.etid,
											name: foundUser.name,
											channelID: foundChannel._id,
											achievementID: foundAchievement.uid,
											earned: currentDate
										}).save();

										new Notice({
											user: foundUser._id,
											logo: foundChannel.logo,
											message: `You have earned the "${foundAchievement.title}" achievement!`,
											date: currentDate,
											type: 'achievement',
											channel: foundChannel.owner,
											status: 'new'
										}).save().then(savedNotice => {
											emitNotificationsUpdate(req, {
												notification: {
													id: savedNotice._id,
													logo: savedNotice.logo,
													message: savedNotice.message,
													date: savedNotice.date,
													type: savedNotice.type,
													channel: savedNotice.channel,
													status: savedNotice.status
												},
												user: foundUser.name
											});
										});

										//check if user has achievement in queue already
										handleTieredBackfill(req, tier, foundChannel, false, foundUser, currentDate, false, true);

										alertAchievement(req, foundChannel, foundUser, foundAchievement);
									}
								})
							}
						}
					} else {
						// User doesn't exist yet, so store the event off to award when signed up!
						let apiURL;
						let userPromise;
						let userObj = {};

						if(userCriteria.name) {
							apiURL = `https://api.twitch.tv/helix/users/?login=${userCriteria.name}`;
						} else if(userCriteria['integration.twitch.etid']) {
							apiURL = `https://api.twitch.tv/helix/users/?id=${userCriteria['integration.twitch.etid']}`;
						}

						if(apiURL) {
							console.log(apiURL);
							userPromise = new Promise((resolve, reject) => {
								axios.get(apiURL, {
									headers: {
										'Client-ID': process.env.TCID
									}
								}).then(res => {
									console.log(res.data);
									if(res.data && res.data.data && res.data.data[0]) {
										userObj.userID = res.data.data[0].id;
										userObj.name = res.data.data[0].login
									}

									resolve();
								});
							})
						} else {
							userPromise = Promise.resolve();
						}

						userPromise.then(() => {
							console.log(userObj);
							if(userObj.userID && userObj.name) {

								Queue.findOne({twitchID: userObj.userID, channelID: foundChannel._id, achievementID: foundAchievement.uid}).then(foundQueue => {
									console.log('hello');
									if(!foundQueue) {
										console.log("didn't find " + foundAchievement.uid + " in the queue.");
										new Queue({
											twitchID: userObj.userID,
											name: userObj.name,
											channelID: foundChannel._id,
											achievementID: foundAchievement.uid,
											earned: currentDate
										}).save().then(savedQueue => {

											handleTieredBackfill(req, tier, foundChannel, false, userObj, currentDate, false, true);

											if(foundChannel.overlay.chat) {
												let alertData = {
													'channel': foundChannel.owner,
													'member': userObj.name,
													'achievement': foundAchievement.title
												};
												
												emitAwardedAchievementNonMember(req, alertData);
											}

											let shouldAlert = foundAchievement.alert || true;
											let unlocked = false;

											if(foundChannel.gold) {
												unlocked = true
											}

											if(shouldAlert) {
												emitOverlayAlert(req, {
													user: userObj.name,
													channel: foundChannel.owner,
													title: foundAchievement.title,
													icon: foundAchievement.icon,
													unlocked
												});
											}
										})
									} else {
										console.log(foundQueue.id);
									}
								}).catch(err => {
									console.log(err);
								});
							}
						});
					}
				});

			} else {
				//achievement found, but it is not earnable
				res.json({});
			}

		} else {
			//achievement wasn't found, do nothing
			res.json({});
		}
	});
}

router.post('/listeners', (req, res) => {
	//Process achievements
	console.log('achievements to process...');
	
	let achievements = req.body;
	
	let currentDate = new Date();

	let sortedListeners = {};

	achievements.forEach(listener => {
		sortedListeners[listener.channel] = sortedListeners[listener.channel] || [];
   		sortedListeners[listener.channel].push(listener)
	});

	let channels = Object.keys(sortedListeners);
	
	channels.forEach(achievementOwner => {

		Channel.findOne({owner: achievementOwner}).then(foundChannel => {

			if(foundChannel) {
				console.log('Issuing achievements for ' + foundChannel.owner + ' channel:');
				let channelListeners = sortedListeners[achievementOwner];
				
				channelListeners.forEach(achievement => {
					let {channel, achievementID, tier, userID} = achievement;
					let userCriteria = {};

					let identifier = achievement.userID || achievement.user;

					if(userID) {
						console.log('>>> userID: ' + userID);
						userCriteria['integration.twitch.etid'] = userID
					} else if(achievement.user) {
						console.log('>>> userName: ' + achievement.user);
						let userName = achievement.user;

						if(userName.indexOf('@') === 0) {
							userName = userName.substr(1);
						}

						userCriteria.name = userName.toLowerCase();
					} else {
						console.log('<<<< No user came from IRC >>>>');
					}

					let achievementCriteria = {
						'_id': achievementID
					};

					handleAchievement(req, res, foundChannel, achievementCriteria, userCriteria, tier);

				});
			}	
		});
	});

});

let handleSubBackfill = (req, achievement, user, foundChannel, tier) => {

	//First time user getting an achievement, lets backfill award
	//Get all sub, resub, & gifted sub listeners for the channel
	Listener.find({achType: { $in: ["0","1"]}, channel: foundChannel.owner}).then(listeners => {
		if(listeners) {
			//Get current listener achieved to get the criteria
			let entryIdx = listeners.findIndex(listener => {
				return listener.achievement === achievement;
			});

			if(entryIdx >=0) {

				let currentListener = listeners.splice(entryIdx, 1)[0];
				let achType = currentListener.achType;
				let condition = currentListener.condition;
				let listenersToAward = [];

				if(achType === "1") {
					console.log('> sub backfilling');				
					//Total Achievement: Backfill only totals
					listeners.forEach(listener => {
						if(listener.achType === "0") {
							if(parseInt(listener.condition) <= parseInt(tier)) {
								listenersToAward.push(listener);
							}
						} else if(parseInt(listener.condition) <= parseInt(condition)) {
							listenersToAward.push(listener);
						}
					});

					if(listenersToAward.length > 0) {
						console.log('> Potentially Backfilling ' + listenersToAward.length + ' achievements');

						let userChannels = user.channels;
						let channelIdx = userChannels.findIndex(savedChannel => {
							return savedChannel.channelID === foundChannel.id;
						});

						let userAchievements = user.channels[channelIdx].achievements;

						let awardedPreviousSub = false;

						listenersToAward.forEach(listener => {
							let achIdx = userAchievements.findIndex(usrAch => {
								return usrAch.aid === listener.aid;
							});

							if(achIdx < 0) {

								awardedPreviousSub = true;
								
								userChannels[channelIdx].achievements.push({aid: listener.aid, earned: Date.now()});
								
							} else {
								console.log('> Achievement already earned: ' + listener.aid)
							}
						});

						if(awardedPreviousSub) {
							new Notice({
								user: user._id,
								logo: foundChannel.logo,
								message: `Your previous subs have been backfilled!`,
								date: new Date(),
								type: 'achievement',
								channel: foundChannel.owner,
								status: 'new'
							}).save().then(savedNotice => {
								emitNotificationsUpdate(req, {
									notification: {
										id: savedNotice._id,
										logo: savedNotice.logo,
										message: savedNotice.message,
										date: savedNotice.date,
										type: savedNotice.type,
										channel: savedNotice.channel,
										status: savedNotice.status
									},
									user: user.name
								});
							});
						}
						
						userChannels[channelIdx].sync = false;

						user.channels = userChannels;
						
						user.save().then(savedUser => {
							console.log(`> ${savedUser.name} has been synced`);
						});
					}
				} else {
					console.log('> The achievement wasn\'t a resub');
				}
			}
		}
	});
}

module.exports = router;