const router = require('express').Router();
const passport = require('passport');
const uuid = require('uuid/v1');

const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Queue = require('../models/queue-model');
const Notice = require('../models/notice-model');
const Image = require('../models/image-model');
const {isAuthorized} = require('../utils/auth-utils');
const {
	emitNewListener,
	emitUpdateListener,
	emitRemoveListener,
	emitAwardedAchievement,
	emitAwardedAchievementNonMember
} = require('../utils/socket-utils');

const uploadImage = require('../utils/image-utils').uploadImage;
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
	
	if(listener.resubType) {
		merge.resubType = listener.resubType;
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
									resubType: existingListener.resubType,
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
								resubType: newListener.resubType,
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
							
							emitUpdateListener(req, {
								uid: updatedListener.uid,
								channel: channel,
								achievement: updatedListener.achievement,
								achType: updatedListener.achType,
								resubType: updatedListener.resubType,
								query: updatedListener.query,
								bot: updatedListener.bot,
								condition: updatedListener.condition
							});

							let merge = combineAchievementAndListeners(updatedAchievement, updatedListener);

							resolve({
								update: true,
								achievement: merge
							});
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

					let {achType, resubType, query, bot, condition} = updates;

					let listenerUpdates = {};

					if(achType) {
						listenerUpdates.achType = achType;
						delete updates.achType;
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

					let achData = {
						uid: existingChannel.nextUID,
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
						achType: req.body.achType,
						uid: uuid()
					};

					if(listenerData.achType !== '0') {
						listenerData.condition = req.body.condition;

						if(listenerData.achType === "1") {
							listenerData.resubType = parseInt(req.body.resubType);
						}
						if(listenerData.achType === "4") {
							listenerData.bot = req.body.bot;
							listenerData.query = req.body.query;
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
															resubType: listenerData.resubType,
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
													resubType: listenerData.resubType,
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

								emitRemoveListener(req, {
									uid: existingListener.uid,
									channel: existingChannel.owner,
									achievement: existingListener.achievement,
									achType: existingListener.achType,
									resubType: existingListener.resubType,
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
		Achievement.findOne({uid: achievementID}).then(foundAchievement => {
			User.find({'name': { $in: members}}).then(foundMembers => {
				let promises = foundMembers.map((member, idx) => {
					let channels = member.channels;
					let channelIdx = channels.findIndex(channel => channel.channelID === existingChannel.id);

					channels[channelIdx].achievements.push({aid: achievementID, earned: Date.now()});
					member.channels = channels;

					return member.save().then(savedMember => {
						emitAwardedAchievement(req, {
							'channel':existingChannel.owner,
							'member': savedMember.name,
							'title': foundAchievement.title
						});
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
	//TODO: Paginate this request
	let channelArray = req.query.channel;

	if(!Array.isArray(channelArray)) {
		channelArray = channelArray.split(',');
	}

	console.log(channelArray);

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

			let channelListeners = sortedListeners[achievementOwner];
			
			channelListeners.forEach(achievement => {
				let {channel, achievementID, tier, userID} = achievement;
				let userCriteria = {};

				let identifier = achievement.userID || achievement.user;

				if(userID) {
					userCriteria['integration.twitch.etid'] = userID
				} else {
					userCriteria.name = achievement.user
				}

				Achievement.findOne({['_id']: achievementID, channel: achievementOwner}).then(foundAchievement => {

					User.findOne(userCriteria).then((foundUser) => {
					
						if(foundUser) {
							userID = foundUser.integration.twitch.etid;

							let entryIdx = foundUser.channels.findIndex(savedChannel => {
								return savedChannel.channelID === foundChannel.id;
							});

							if(entryIdx >= 0) {
								//User already a part of this channel
								let userAchievements = foundUser.channels[entryIdx].achievements;
								let sync = foundUser.channels[entryIdx].sync;

								let achIdx = userAchievements.findIndex(usrAch => {
									return usrAch.id === foundAchievement.id;
								});

								if(achIdx < 0) {
									foundUser.channels[entryIdx].achievements.push({
										aid: foundAchievement.uid,
										earned: currentDate
									});

									if(sync && tier) {
										handleSubBackfill(foundAchievement.id, foundUser, foundChannel);
									} else {
										foundUser.save();
									}

									emitAwardedAchievement(req, {
										'channel': channel,
										'member': foundUser.name,
										'achievement': foundAchievement.title
									});

								}
							} else {
								//TODO: User preference to auto join channel?
								if(foundUser.preferences.autojoin) {
									foundUser.channels.push({
										channelID: foundChannel.id,
										achievements: [{
											id: achievementID,
											earned: currentDate
										}]
									});
									foundUser.save().then(savedUser => {
										foundChannel.members.push(savedUser._id);
										foundChannel.save().then(savedChannel => {
											//TODO: Reorganize notice model
											new Notice({
												twitchID: userID,
												channelID: foundChannel._id,
												achievementID: achievementID
											}).save().then(savedNotice => {

												emitAwardedAchievement(req, {
													'channel':channel,
													'member': foundUser.name,
													'achievement': foundAchievement.title
												});
											});	
										})
									});
								} else {
									new Queue({
										twitchID: foundUser.integration.twitch.etid,
										name: foundUser.name,
										channelID: foundChannel._id,
										achievementID: achievementID
									}).save();

									new Notice({
										twitchID: userID,
										channelID: foundChannel._id,
										achievementID: achievementID
									}).save();

									emitAwardedAchievement(req, {
										channel,
										'member': foundUser.name,
										'achievement': foundAchievement.title
									});
								}
							}	
						} else {
							// User doesn't exist yet, so store the event off to award when signed up!
							//TODO: Handle this (make call to users API to get name from ID, or ID from name)
							let userObj = {
								userID: achievement.userID,
								name: achievement.user
							};
							let apiURL;
							let userPromise;

							if(!userObj.userID) {
								apiURL = `https://api.twitch.tv/helix/users/?login=${achievement.user}`;
							} else if(!userObj.name) {
								apiURL = `https://api.twitch.tv/helix/users/?id=${achievement.userID}`;
							}

							if(apiURL) {
								userPromise = new Promise((resolve, reject) => {
									axios.get(apiURL, {
										headers: {
											'Client-ID': process.env.TCID
										}
									}).then(res => {
										userObj.userID = res.data.data[0].id;
										userObj.name = res.data.data[0].login

										resolve();
									});
								})
							} else {
								userPromise = Promise.resolve();
							}

							userPromise.then(() => {
								Queue.findOne({twitchID: userObj.userID}).then(foundQueue => {
									if(!foundQueue) {
										new Queue({
											twitchID: userObj.userID,
											name: userObj.name,
											channelID: foundChannel._id,
											achievementID: achievementID
										}).save().then(savedQueue => {
											emitAwardedAchievementNonMember(req, {
												'channel': channel,
												'member': userObj.name,
												'achievement': foundAchievement.title
											});
										})
									}
								});
							});
						}
					});
				});
			});
		});
	});
});

let handleSubBackfill = (achievement, foundUser, foundChannel) => {
	//First time user getting an achievement, lets backfill award
	//Get all sub, resub, & gifted sub listeners for the channel
	Listener.find({achType: { $in: ["0","1"]}, channel: foundChannel.owner}).then(listeners => {
		if(listeners) {
			//Get current listener achieved to get the criteria
			let entryIdx = listeners.findIndex(listener => {
				return listener.achievement === achievement;
			});

			let currentListener = listeners.splice(entryIdx, 1)[0];
			let achType = currentListener.achType;
			let condition = currentListener.condition;
			let listenersToAward = [];

			if(achType === "1") {
				let resubType = currentListener.resubType;

				if(resubType === "0") {
					//Streak Achievement: Backfill streaks and totals
					listeners.forEach(listener => {
						if(listener.condition <= condition) {
							listenersToAward.push(listener);
						}
					});
				} else {
					//Total Achievement: Backfill only totals
					listeners.forEach(listener => {
						if(listener.achType === "0") {
							listenersToAward.push(listener);
						} else if(listener.resubType === "1" && listener.condition <= condition) {
							listenersToAward.push(listener);
						}
					});
				}

				if(listenersToAward.length > 0) {
					let userChannels = foundUser.channels;
					let channelIdx = userChannels.findIndex(savedChannel => {
						return savedChannel.channelID === foundChannel.id;
					});

					listenersToAward.forEach(listener => {
						userChannels[channelIdx].achievements.push({aid: listener.aid, earned: Date.now()});
						new Notice({
							twitchID: foundUser.integration.twitch.etid,
							channelID: foundChannel._id,
							achievementID: achievement
						}).save();
					});
					userChannels[channelIdx].sync = false;

					foundUser.channels = userChannels;
					
					foundUser.save().then(savedUser => {

					});
				}
			}
		}
	});
}

module.exports = router;