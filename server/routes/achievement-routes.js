const router = require('express').Router();
const passport = require('passport');
const uuid = require('uuid/v1');
const axios = require('axios');

const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Notice = require('../models/notice-model');
const Image = require('../models/image-model');
const Earned = require('../models/earned-model');
const Event = require('../models/event-model');
const {
	isAuthorized,
	isModAuthorized,
	getTwitchAxiosInstance
} = require('../utils/auth-utils');
const {
	emitNewListener,
	emitUpdateListener,
	emitRemoveListener,
	emitAwardedAchievement,
	emitAwardedAchievementNonMember,
	emitOverlayAlert,
	emitNotificationsUpdate,
	emitExtensionAchievementEarned
} = require('../utils/socket-utils');
const { build } = require('../utils/regex-builder');

const uploadImage = require('../utils/image-utils').uploadImage;
const DEFAULT_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png";
const mongoose = require('mongoose');

let combineAchievementAndListeners = (achievement, listener) => {
	if(achievement && listener) {
		let merge = {
			"_id": achievement['_id'],
			channel: achievement.owner,
			title: achievement.title,
			description: achievement.description,
			shortDescription: achievement.shortDescription,
			icon: achievement.icon,
			earnable: achievement.earnable,
			limited: achievement.limited,
			secret: achievement.secret,
			listener: achievement.listener,
			achType: listener.achType,
			condition: listener.condition,
			rank: achievement.rank
		}
		
		if(listener.query) {
			merge.query = listener.query;
		}

		return merge;
	} else {
		return false;
	}
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

								let listenerData = {
									uid: updatedListener.uid,
									channel: channel,
									achievement: updatedListener.achievement,
									achType: updatedListener.achType,
									query: updatedListener.query,
									bot: updatedListener.bot,
									condition: updatedListener.condition,
									unlocked: updatedListener.unlocked
								};

								emitUpdateListener(req, listenerData);

								let merge = combineAchievementAndListeners(updatedAchievement, updatedListener);

								resolve({
									update: true,
									achievement: merge
								});
							} else {
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
		Image.find({ownerID: owner, type: "achievement"}).then(foundImages => {
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

router.post('/mod/update', isModAuthorized, (req, res) => {
	handleUpdate(req, res, req.channel, true);
});

router.post('/update', isAuthorized, (req, res) => {
	
	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		if(existingChannel) {
			handleUpdate(req, res, existingChannel, false);
		} else {
			res.json({
				update: false,
				message: "The channel you tried to update the achievement for doesn't exist!"
			});
		}
	});
});

let handleUpdate = (req, res, existingChannel, isMod) => {
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
				uploadImage(updates.icon, updates.iconName, updates.iconType, existingChannel.owner).then(iconImg => {
					if(iconImg.error) {
						res.json({
							update: false,
							error: iconImg.error
						})
					} else {
						updates.icon = iconImg.url;

						updateAchievement(req, existingChannel.owner, existingAchievement, updates, listenerUpdates, iconImg).then(response => {
							res.json(response);
						});
					}
				});
			} else {
				updateAchievement(req, existingChannel.owner, existingAchievement, updates, listenerUpdates).then(response => {
					res.json(response);
				});
			}

		} else {
			res.json({
				update: false,
				error: "The achievement you tried to update doesn't exist!"
			});
		}
	});
}

router.post("/mod/create", isModAuthorized, (req, res) => {
	createAchievement(req, res, req.channel, true);
});

router.post("/create", isAuthorized, (req, res) => {
	
	Channel.findOne({ownerID: req.user.id}).then((existingChannel) => {
		if(existingChannel) {
			createAchievement(req, res, existingChannel, false);
		} else {
			res.json({
				created: false,
				message: "This channel you are creating for doesn't exist!"
			});
		}	
	});
});

let createAchievement = async (req, res, existingChannel, isMod) => {
	let query = {};

	if(req.body.id) {
		query['_id'] = req.body.id;
	} else {
		query.title = req.body.title;
	}

	query.ownerID = existingChannel.ownerID;

	let customAllowed = isCustomAllowed(existingChannel);

	if(req.body.achType === "4" && !existingChannel.gold && customAllowed === 0) {
		res.json({
			created: false,
			message: "This type of achievement is for Stream Achievements Gold! Sync your Patreon if your account is, or reach out on Discord!",
		});

	} else {

		let foundUser = await User.findOne({'_id': existingChannel.ownerID})

		let streamlabs = existingChannel.integrations.streamlabs;

		if((req.body.achType === "5" || req.body.achType === "6") && !streamlabs) {
			res.json({
				created: false,
				message: "This type of achievement requires Streamlabs integration! Head over to your Profile and connect!",
			});
		} else {
			let existingAchievement = await Achievement.findOne(query);

			if(existingAchievement) {
				res.json({
					created: false,
					message: "An achievement with this name already exists!",
					achievement: existingAchievement
				});
			} else {

				let preCount = await Achievement.countDocuments({ownerID: existingChannel.ownerID});

				let achData = {
					uid: existingChannel.nextUID,
					ownerID: existingChannel.ownerID,
					title: req.body.title,
					description: req.body.description,
					shortDescription: req.body.shortDescription,
					icon: req.body.icon,
					earnable: req.body.earnable,
					limited: req.body.limited,
					secret: req.body.secret,
					listener: req.body.listener,
					alert: req.body.alert || true,
					rank: req.body.rank || 0,
					order: preCount
				};

				let listenerData = {
					ownerID: existingChannel.ownerID,
					achType: req.body.achType,
					uid: uuid()
				};

				listenerData.condition = req.body.condition;

				if(listenerData.achType === "4" || listenerData.achType === "5") {
					listenerData.bot = req.body.bot;
					listenerData.query = req.body.query;
				}

				let foundListener = await Listener.findOne(listenerData);

				if(foundListener) {
					let foundAchievement = await Achievement.findOne({listener: foundListener._id});
					
					res.json({
						created: false,
						message: "The conditions you selected are already taken by the \"" + foundAchievement.title + "\" achievement!"
					});
				} else {
					let newAchievement;

					if(req.body.icon) {
						let imgResult = await uploadImage(req.body.icon, req.body.iconName, existingChannel.ownerID);
						achData.icon = imgResult.url;

						newAchievement = await new Achievement(achData).save();

						imgResult.achievementID = newAchievement.id;
						await imgResult.save();
					} else {
						newAchievement = await new Achievement(achData).save();
					}
					
					listenerData.achievement = newAchievement.id;
					listenerData.aid = newAchievement.uid;

					if(req.body.platforms) {
						listenerData.platforms = req.body.platforms
					} else {
						
						let platform = Object.keys(existingChannel.platforms.toJSON())[0];

						listenerData.platforms = [platform];
				
					}
					
					existingChannel.nextUID = newAchievement.uid + 1;
					let updatedChannel = await existingChannel.save();

					//create listener for achievement
					if(req.body.achType !== "3") {
						let newListener = await new Listener(listenerData).save();
							
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

						let updatedAchievement = await newAchievement.save();
						res.json({
							created: true,
							achievement: updatedAchievement
						});
					} else {
						res.json({
							created: true,
							achievement: newAchievement
						});
					}
				}
			}
		}
	}
}

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
					let uid = existingAchievement.uid;

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
										
										Earned.deleteMany({channelID: existingChannel.id, achievementID: uid}).then(err => {
											res.json({
												deleted:true
											});
										})
									});
								});
							} else {
								Image.findOneAndUpdate({achievementID: req.body.achievementID}, { $set: {achievementID: ''}}).then(updatedImage => {
									Earned.deleteMany({channelID: existingChannel.id, achievementID: uid}).then(err => {
										res.json({
											deleted:true
										});
									})
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

router.post("/enable", isAuthorized, (req, res) => {
	let achievement = req.body.aid;

	Listener.findOne({channel: req.user.name, unlocked: true}).then(enabledListener => {
		if(enabledListener) {
			enabledListener.unlocked = false;
			enabledListener.save().then(nowDisabledListener => {
				emitUpdateListener(req, {
					channel: nowDisabledListener.channel,
					achievement: nowDisabledListener.achievement,
					achType: nowDisabledListener.achType,
					query: nowDisabledListener.query,
					bot: nowDisabledListener.bot,
					condition: nowDisabledListener.condition,
					unlocked: false
				});
			});
		}

		Listener.findOne({channel: req.user.name, aid: achievement}).then(disabledListener => {
			disabledListener.unlocked = true;
			disabledListener.save().then(nowEnabledListener => {
				emitUpdateListener(req, {
					channel: nowEnabledListener.channel,
					achievement: nowEnabledListener.achievement,
					achType: nowEnabledListener.achType,
					query: nowEnabledListener.query,
					bot: nowEnabledListener.bot,
					condition: nowEnabledListener.condition,
					unlocked: true
				});
				res.json({
					unlocked: nowEnabledListener.unlocked
				});
			})
		})
	})
})

router.get("/mod/retrieve", isModAuthorized, (req, res) => {
	let achievement = req.query.aid;

	getAchievementData(req, res, req.channel, achievement);
});

router.get("/retrieve", isAuthorized, (req, res) => {
	let channel = req.user.name;
	let achievement = req.query.aid;

	if(achievement) {
		Channel.findOne({ownerID: req.user.id}).then((existingChannel) => {
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

let getAchievementData = async (req, res, existingChannel, achievement) => {
	let achievementPromise = new Promise((resolve, reject) => {
		Achievement.findOne({uid: achievement, ownerID: existingChannel.ownerID}).then(existingAchievement => {

			if(existingAchievement) {
				
				let listenerID = existingAchievement.listener;
				
				Listener.findOne({"_id": existingAchievement.listener, ownerID: existingAchievement.ownerID}).then(existingListener => {

					if(existingListener) {
						let listenerData = Object.assign({}, existingListener['_doc']);
						let achievementData = Object.assign({}, existingAchievement['_doc']);

						delete listenerData._id;

						let mergedAchievement = Object.assign(achievementData, listenerData);

						if(!mergedAchievement.unlocked) {
							mergedAchievement.unlocked = false;
						}

						resolve(mergedAchievement);
					} else {
						resolve(existingAchievement);
					}
				})

			} else {
				resolve(null);
			}
		})
	});

	let imagePromise = retrieveImages(existingChannel.ownerID);

	let customAllowed = isCustomAllowed(existingChannel);

	Promise.all([achievementPromise, imagePromise, customAllowed]).then(responses => {
		res.json({
			achievement: responses[0],
			images: responses[1],
			defaultIcons: existingChannel.icons,
			isGoldChannel: ((req.channel && req.channel.gold)),
			customAllowed: responses[2],
			referred: existingChannel.referral.referred > 0,
			channel: existingChannel
		});
	});
}

router.post('/mod/award', isModAuthorized, (req, res) => {
	manualAward(req, res, req.channel);
});

router.post('/award', isAuthorized, (req, res) => {	

	Channel.findOne({ownerID: req.user.id}).then((existingChannel) => {
		manualAward(req, res, existingChannel);
	});
});

let buildAchievementMessage = (channel, achievementData) => {
	let overlaySettings = channel.overlay;
	let chatMessage;

	if(overlaySettings.chatMessage && overlaySettings.chatMessage !== '') {
		chatMessage = build({
			chatMessage: overlaySettings.chatMessage,
			member: achievementData.member,
			achievement: achievementData.achievement
		});
	} else {
		chatMessage = `${achievementData.member} just earned the "${achievementData.achievement}" achievement! PogChamp`;
	}

	return {
		channel: channel.owner,
		message: chatMessage
	}
}

let manualAward = (req, res, existingChannel) => {
	let members = req.body.members;
	let nonMember;
	let achievementID = req.body.aid;
	let currentDate = Date.now();
	let first = false;

	let nonMemberIdx = members.findIndex(member => member.nonMember === true);

	if(nonMemberIdx >= 0) {
		nonMember = members.splice(nonMemberIdx, 1)[0]; 
	}

	Achievement.findOne({uid: achievementID, channel: existingChannel.owner}).then(foundAchievement => {
		members = members.map(member => member.name);
		
		User.find({'name': { $in: members}}).then(foundMembers => {
			let promises;

			if(foundMembers.length > 0) {
				Earned.find({channelID: existingChannel.id, achievementID: foundAchievement.uid}).limit(1).exec((err, earnedDocs) => {
					first = (earnedDocs.length === 0);
				
					foundMembers.map((member, idx) => {
						let earnedObj = {
							userID: member.id,
							channelID: existingChannel.id,
							achievementID: foundAchievement.uid
						}

						Earned.findOne(earnedObj).then(foundEarned => {
							if(!foundEarned) {
								new Earned({
									...earnedObj,
									earned: Date.now(),
									first
								}).save().then(savedEarned => {
									
									first = false;

									if(existingChannel.overlay.chat) {
										let alertData = {
											'channel':existingChannel.owner,
											'member': member.name,
											'achievement': foundAchievement.title
										};

										emitAwardedAchievement(req, buildAchievementMessage(existingChannel, alertData));

										emitExtensionAchievementEarned(req, {
											user: member.integration.twitch.etid,
											aid: foundAchievement.uid
										});

										logChannelEvent(req, existingChannel, member, foundAchievement);
									}

									new Notice({
										user: member._id,
										logo: existingChannel.logo,
										message: `You have earned the "${foundAchievement.title}" achievement!`,
										date: currentDate,
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
											user: member.name
										});
									});
									
									let shouldAlert = foundAchievement.alert || true;
									let unlocked = false;

									if(existingChannel.gold) {
										unlocked = true
									}

									if(shouldAlert) {
										emitOverlayAlert(req, {
											user: member.name,
											channel: existingChannel.owner,
											title: foundAchievement.title,
											icon: foundAchievement.icon,
											unlocked
										});	
									}

								})
							}
						})
					});

					if(nonMember) {
						handleNonMemberAward(req, res, existingChannel, foundAchievement, nonMember);
					}

					res.json({
						award: true
					});
				});
			} else {
			
				//Check if nonMember to award
				if(nonMember) {
					handleNonMemberAward(req, res, existingChannel, foundAchievement, nonMember);
				}

				res.json({
					award: true
				});
			}
		})
	});
}

let handleNonMemberAward = (req, res, foundChannel, foundAchievement, nonMember) => {
	let currentDate = Date.now();
	let first = false;

	User.findOne({name: nonMember.name}).then(foundUser => {
		if(foundUser) {
			//user is part of the site
			if(foundUser.preferences.autojoin) {
				try {
					foundUser.channels.push({
						channelID: foundChannel.id,
						banned: false
					});
					foundUser.save().then(savedUser => {
						foundChannel.members.push(savedUser.id);
						foundChannel.save().then(savedChannel => {
							
							Earned.find({channelID: foundChannel.id, achievementID: foundAchievement.uid}).limit(1).exec((err, earnedDocs) => {
								first = (earnedDocs.length === 0);
							
								let earnedObj = {
									userID: foundUser.id,
									channelID: foundChannel.id,
									achievementID: foundAchievement.uid
								}

								Earned.findOne(earnedObj).then(foundEarned => {
									if(!foundEarned) {
										new Earned({
											...earnedObj,
											earned: Date.now(),
											first
										}).save().then(savedEarned => {
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

												alertAchievement(req, foundChannel, savedUser, foundAchievement);
											});	
										});
									}
								});
							})
						});
					});
				} catch(err) {

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
			} else {
				Earned.find({channelID: foundChannel.id, achievementID: foundAchievement.uid}).limit(1).exec((err, earnedDocs) => {
					first = (earnedDocs.length === 0);
				
					let earnedObj = {
						userID: foundUser.id,
						channelID: foundChannel.id,
						achievementID: foundAchievement.uid
					};

					Earned.findOne(earnedObj).then(foundEarned => {
						if(!foundEarned) {
							new Earned({
								...earnedObj,
								earned: Date.now(),
								first
							}).save().then(savedEarned => {
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

								alertAchievement(req, foundChannel, foundUser, foundAchievement);
							});
						}
					});
				})
			}
		} else {
			// User doesn't exist yet, so store the event off to award when signed up!
			let userPromise;
			let userObj = {};

			userPromise = new Promise((resolve, reject) => {
				getTwitchAxiosInstance().then(instance => {
					instance.get(`https://api.twitch.tv/helix/users/?login=${nonMember.name}`).then(res => {

						if(res.data && res.data.data && res.data.data[0]) {
							userObj.userID = res.data.data[0].id;
							userObj.name = res.data.data[0].login
						}

						resolve();
					});
				});
			})

			userPromise.then(() => {

				if(userObj.userID && userObj.name) {
					//TODO: Add entry in Earned if it doesn't exist
					Earned.find({channelID: foundChannel.id, achievementID: foundAchievement.uid}).limit(1).exec((err, earnedDocs) => {
						first = (earnedDocs.length === 0);
					
						let earnedObj = {
							userID: userObj.userID,
							channelID: foundChannel.id,
							achievementID: foundAchievement.uid
						};

						Earned.findOne(earnedObj).then(foundEarned => {
							if(!foundEarned) {
								new Earned({
									...earnedObj,
									earned: Date.now(),
									first
								}).save().then(savedEarned => {

									if(foundChannel.overlay.chat) {
										let alertData = {
											'channel': foundChannel.owner,
											'member': userObj.name,
											'achievement': foundAchievement.title
										};
										
										emitAwardedAchievementNonMember(req, buildAchievementMessage(foundChannel, alertData));

										emitExtensionAchievementEarned(req, {
											user: userObj.userID,
											aid: foundAchievement.uid
										});

										logChannelEvent(req, foundChannel, userObj, foundAchievement);
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
								});
							}
						});
					})
				}
			});
		}
	})
}

router.get('/mod/icons', isModAuthorized, (req, res) => {
	getIcons(req, res, req.channel, true);
});

router.get('/icons', isAuthorized, (req, res) => {
	Channel.findOne({ownerID: req.user.id}).then((existingChannel) => {
		if(existingChannel) {
			getIcons(req, res, existingChannel, false);
		} else {
			res.json({
				error: true
			});
		}
	});
});

let getIcons = (req, res, existingChannel, isMod) => {
	//Get Images
	retrieveImages(existingChannel.owner).then(images => {
		let retImages = images.map(image => {
			let tempImg = {...image['_doc']};
			delete tempImg['__v'];
			delete tempImg['_id'];

			return tempImg;
		});

		let resObj = {
			images: retImages,
			defaultIcons: existingChannel.icons,
			channel: {
				integrations: existingChannel.integrations
			}
		}


		if(isMod) {
			resObj.isGoldChannel = existingChannel.gold;
		}

		isCustomAllowed(existingChannel).then(isAllowed => {
			resObj.customAllowed = isAllowed;

			res.json(resObj);
		});
	});
}

let isCustomAllowed = (channel) => {
	let {ownerID, gold, referral} = channel;

	if(gold) {
		return Promise.resolve(true);
	} else {
		//gather how many total
		let totalAllowed = 0;

		if(referral && referral.referred > 0) {
			totalAllowed = totalAllowed + 1;
		}

		return new Promise((resolve, reject) => {
			Listener.find({ownerID: ownerID, achType: "4"}).then(listeners => {
				if(totalAllowed === 0) {
					resolve(false)
				} else if(listeners) {
					if(totalAllowed < listeners.length) {
						resolve(0);
					} else {
						resolve(totalAllowed - listeners.length);
					}
				}
			});
		});
	}
}

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

let logChannelEvent = (req, channel, user, achievement) => {
	let event = "";
	let platform = req.body.platform;

	event = `${user.name} earned "${achievement.title}"`;

	new Event({
		channelID: channel.id,
		member: user.name,
		platform: platform,
		achievement: achievement.title,
		date: Date.now()
	}).save();
}

let alertAchievement = (req, foundChannel, savedUser, foundAchievement) => {
	if(foundChannel.overlay.chat) {
		let alertData = {
			'channel': foundChannel.owner,
			'member': savedUser.name,
			'achievement': foundAchievement.title
		};
		
		emitAwardedAchievement(req, buildAchievementMessage(foundChannel, alertData));

		let etid = "";
		if(savedUser.integration && savedUser.integration.twitch) {
			etid = savedUser.integration.twitch.etid;
		} else {
			etid = savedUser.userID;
		}

		emitExtensionAchievementEarned(req, {
			user: etid,
			aid: foundAchievement.uid
		});

		logChannelEvent(req, foundChannel, savedUser, foundAchievement);
	}
	
	
	let shouldAlert = ((typeof foundAchievement.alert !== 'undefined') ? foundAchievement.alert : true);
	
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

let handleTieredBackfill = (req, tier, foundChannel, savedUser, currentDate, queue) => {
	//handle awarding achievement for tiers (3 gives 3,2,1)

	let userID = ((savedUser.id) ? savedUser.id : savedUser.userID);

	if(tier && tier !== "1000") {
		let tierCriteria = [];
		
		if(tier === "2000") {
			tierCriteria.push("1000");
			tierCriteria.push("2000");
		} else if(tier === "3000") {
			tierCriteria.push("1000");
			tierCriteria.push("2000");
			tierCriteria.push("3000");
		}

		Listener.find({achType: "0", condition: { $in: tierCriteria}, channel: foundChannel.owner}).then(listeners => {

			let achievementsToAward = [];
			
			if(listeners) {

				let achievementPromise = new Promise((resolve, reject) => {
					//TODO: Add entry to Earned table

					let achIDs = listeners.map(listener => listener.aid);
					
					Earned.find({userID, channelID: foundChannel.id, achievementID: { $in: achIDs}}).then(foundEarneds => {
						if(foundEarneds && foundEarneds.length > 0) {

							foundEarneds.forEach(found => {
								let idx = achIDs.findIndex(ach => ach === found.achievementID);
								if(idx >= 0) {
									achIDs.splice(idx, 1);
								}
							});
						}

						achievementsToAward = achIDs;

						resolve();
					});

				});

				achievementPromise.then(() => {
					if(achievementsToAward.length > 0) {
						Achievement.find({channel: foundChannel.owner, uid: { $in: achievementsToAward}}).then(tieredAchievements => {
							if(tieredAchievements) {

								tieredAchievements.forEach(tierAch => {

									addToEarned(req, savedUser, foundChannel, tierAch, false);
									
								});

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

let addToEarned = (req, foundUser, foundChannel, foundAchievement, tier, alert = true) => {

	return new Promise((resolve, reject) => {

		let currentDate = Date.now();

		Earned.find({channelID: foundChannel.id, achievementID: foundAchievement.uid}).limit(1).exec((err, earnedDocs) => {
			let earnedObj = {
				userID: ((foundUser.id) ? foundUser.id : foundUser.userID),
				channelID: foundChannel.id,
				achievementID: foundAchievement.uid
			};

			Earned.findOne(earnedObj).then(foundEarned => {
				if(!foundEarned) {
					new Earned({
						...earnedObj,
						earned: currentDate,
						first: (earnedDocs.length === 0)
					}).save().then(savedEarned => {
						if(alert) {
							if(foundUser.integration) {
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
							}

							alertAchievement(req, foundChannel, foundUser, foundAchievement);
						}

						if(tier) {
							//User already has achievement, but reward those past
							handleTieredBackfill(req, tier, foundChannel, foundUser, currentDate);

							handleSubBackfill(req, foundUser, foundChannel, foundAchievement, tier);
						}

						resolve(true);
					});
				} else {
					if(tier) {
						//User already has achievement, but reward those past
						handleTieredBackfill(req, tier, foundChannel, foundUser, currentDate);

						handleSubBackfill(req, foundUser, foundChannel, foundAchievement, tier);
					}

					resolve(false);
				}

			});
		});
	});
}

let handleUserAchievements = (req, res, user, retry=2) => {
	let {channel, identifier, achievements} = user;

	let mapping = {};

	let achievementIDs = achievements.map(achievement => {
		mapping[achievement.achievementID] = achievement.tier;
		return achievement.achievementID;
	});

	Achievement.find({'_id': { $in: achievementIDs}, earnable: true}).then(foundAchievements => {
		if(foundAchievements.length > 0) {
			User.findOne(identifier).then(foundUser => {
				if(foundUser) {
					let entryIdx = foundUser.channels.findIndex(savedChannel => {
						return savedChannel.channelID === channel.id;
					});

					if(entryIdx >= 0 && !foundUser.channels[entryIdx].banned) {
						try {
							foundAchievements.forEach(foundAchievement => {
								addToEarned(req, foundUser, channel, foundAchievement, mapping[foundAchievement.id]);
							});
						} catch (err) {
							//Error saving achievement, retry
							new Notice({
								user: process.env.NOTICE_USER,
								logo: DEFAULT_ICON,
								message: `Issue awarding ${channel.owner}'s '${foundAchievement.title}' to ${foundUser.name}`,
								date: currentDate,
								type: 'admin',
								status: 'new'
							}).save();

							User.findOne({name: channel.owner}).then(foundOwner => {
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
					} else {

						if(foundUser.preferences.autojoin) {
							try {
								foundUser.channels.push({
									channelID: channel.id,
									banned: false
								});
								foundUser.save().then(savedUser => {
									channel.members.push(savedUser.id);
									channel.save().then(savedChannel => {
										foundAchievements.forEach(foundAchievement => {
											addToEarned(req, savedUser, savedChannel, foundAchievement, mapping[foundAchievement.id]);
										});
									});
								});
							} catch(err) {
								new Notice({
									user: process.env.NOTICE_USER,
									logo: DEFAULT_ICON,
									message: `Issue awarding ${channel.owner}'s '${foundAchievement.title}' to ${foundUser.name}`,
									date: currentDate,
									type: 'admin',
									status: 'new'
								}).save();

								User.findOne({name: channel.owner}).then(foundOwner => {
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
						} else {
							foundAchievements.forEach(foundAchievement => {
								addToEarned(req, foundUser, channel, foundAchievement, mapping[foundAchievement.id]);
							});
						}
					}
				} else {
					console.log('user not found, call to twitch');
					// User doesn't exist yet, so store the event off to award when signed up!
					let apiURL;
					let userPromise;
					let userObj = {};
					let etid = identifier['integration.twitch.etid'];

					if(etid && etid !== 'undefined' && user.name) {
						console.log('Call not needed');
						//we grabbed the info when sorting achievements, no need to call to twitch again
						userObj.userID = identifier['integration.twitch.etid'];
						userObj.name = user.name;

						foundAchievements.forEach(foundAchievement => {
							addToEarned(req, userObj, channel, foundAchievement, mapping[foundAchievement.id]);
						});					
					} else {
						if(identifier.name) {
							apiURL = `https://api.twitch.tv/helix/users/?login=${identifier.name}`;
						} else if(etid && etid !== 'undefined') {
							apiURL = `https://api.twitch.tv/helix/users/?id=${etid}`;
						}

						if(apiURL) {

							userPromise = new Promise((resolve, reject) => {
								getTwitchAxiosInstance().then(instance => {

									instance.get(apiURL).then(res => {
										if(res.data && res.data.data && res.data.data[0]) {
											userObj.userID = res.data.data[0].id;
											userObj.name = res.data.data[0].login
										}

										resolve();
									}).catch(error => {
										if(error.response) {
											console.log(error.response.data);
											resolve();
										}
									});
								});
							})
						} else {
							userPromise = Promise.resolve();
						}

						userPromise.then(() => {

							if(userObj.userID && userObj.name) {
								foundAchievements.forEach(foundAchievement => {
									addToEarned(req, userObj, channel, foundAchievement, mapping[foundAchievement.id]);
								});
							}
						});
					}
				}
			})
		}
	})

}

let handleAchievement = (req, res, foundChannel, achievementCriteria, userCriteria, tier, retry=2) => {
	
	let currentDate = new Date();

	Achievement.findOne(achievementCriteria).then(foundAchievement => {
		if(foundAchievement) {
			if(foundAchievement.earnable) {

				User.findOne(userCriteria).then((foundUser) => {
					if(foundUser) {

						let entryIdx = foundUser.channels.findIndex(savedChannel => {
							return savedChannel.channelID === foundChannel.id;
						});

						if(entryIdx >= 0 && !foundUser.channels[entryIdx].banned) {
							//User already a part of this channel
							
							try {
								addToEarned(req, foundUser, foundChannel, foundAchievement, tier);
							} catch (err) {
								//Error saving achievement, retry
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
							//TODO: Handle banning someone who is not part of the channel yet
							console.log("couldn't find the channel");
							
							//TODO: Add entry in Earned

							if(foundUser.preferences.autojoin) {
								try {
									foundUser.channels.push({
										channelID: foundChannel.id,
										banned: false
									});
									foundUser.save().then(savedUser => {
										foundChannel.members.push(savedUser.id);
										foundChannel.save().then(savedChannel => {
											addToEarned(req, savedUser, savedChannel, foundAchievement, tier);
										});
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
								addToEarned(req, foundUser, foundChannel, foundAchievement, tier);
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

							userPromise = new Promise((resolve, reject) => {
								getTwitchAxiosInstance().then(instance => {
									instance.get(apiURL).then(res => {
										if(res.data && res.data.data && res.data.data[0]) {
											userObj.userID = res.data.data[0].id;
											userObj.name = res.data.data[0].login
										}

										resolve();
									}).catch(err => {
										console.log(err);
										reject();
									});
								});
							})
						} else {
							userPromise = Promise.resolve();
						}

						userPromise.then(() => {

							if(userObj.userID && userObj.name) {
								addToEarned(req, userObj, foundChannel, foundAchievement, tier);
							}
						}).catch(() => {
							console.log("Error occured awarding " + foundAchievement.title + " to " + JSON.stringify(userCriteria));
						});
					}
				});

			} else {
				//achievement found, but it is not earnable
			}

		} else {
			//achievement wasn't found, do nothing
		}
	});
}

router.post('/listeners', async (req, res, next) => {
	//Process achievements
	try {
		console.log('achievements to process...');
		
		let achievements = req.body;
		
		let currentDate = new Date();

		let sortedListeners = {};
		let etidMap = {};

		await asyncForEach(achievements, async (listener) => {
			sortedListeners[listener.channel] = sortedListeners[listener.channel] || [];
	   		sortedListeners[listener.channel].push(listener)
		});

		let channels = Object.keys(sortedListeners);

		await asyncForEach(channels, async (achievementOwner) => {

			let foundChannel = await Channel.findOne({owner: achievementOwner})

			if(foundChannel) {
				let channelListeners = sortedListeners[achievementOwner];

				//sort by user
				let userListeners = {};

				await asyncForEach(channelListeners, async (achievement) => {
					
					let {channel, achievementID, tier, userID} = achievement;
					let userCriteria = {};
					let identifier;

					if(userID) {
						identifier = userID;

						if(!userListeners[identifier]) {
							userListeners[identifier] = {
								channel: foundChannel,
								identifier: {'integration.twitch.etid': userID},
								achievements: []
							}
						}

					} else {
						let userName = achievement.user.toLowerCase();

						if(userName.indexOf('@') === 0) {
							userName = userName.substr(1);
						}						

						if(!etidMap.hasOwnProperty(userName)) {
							let foundUser = await User.findOne({name: userName});

							if(foundUser) {
								etidMap[userName] = foundUser.integration.twitch.etid;
							} else {
								let apiURL = `https://api.twitch.tv/helix/users/?login=${userName}`;

								if(apiURL) {

									let instance = await getTwitchAxiosInstance();

									let res = await instance.get(apiURL);

									if(res.data && res.data.data && res.data.data[0]) {
										etidMap[userName] = res.data.data[0].id;
									} else {
										console.log('error retrieveing data for ' + userName);
										etidMap[userName] = 'undefined'
									}
								}
							}
						}

						identifier = etidMap[userName];

						if(!userListeners[identifier]) {
							userListeners[identifier] = {
								channel: foundChannel,
								identifier: {'integration.twitch.etid': identifier},
								name: userName,
								achievements: []
							}
						}
					}

					userListeners[identifier].achievements.push(achievement);
				})

				let userKeys = Object.keys(userListeners);

				//TODO: If a user comes in as name and ID both, merge them together if they are already a member of the site. This is not a problem if they haven't joined yet
				
				await asyncForEach(userKeys, async (userKey) => {
					let user = userListeners[userKey];

					handleUserAchievements(req, res, user);
				});
			}
		});
	} catch (e) {
		next(e);
	}

	res.json({});

});

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

let handleSubBackfill = (req, foundUser, foundChannel, foundAchievement, tier) => {
	//First time user getting an achievement, lets backfill award
	//Get all sub, resub, & gifted sub listeners for the channel
	Listener.find({achType: { $in: ["0","1"]}, channel: foundChannel.owner}).then(listeners => {
		
		if(listeners) {
			//Get current listener achieved to get the criteria
			let entryIdx = listeners.findIndex(listener => {
				return listener.achievement === foundAchievement.id;
			});

			if(entryIdx >=0) {

				let currentListener = listeners.splice(entryIdx, 1)[0];
				let achType = currentListener.achType;
				let condition = currentListener.condition;
				let listenersToAward = [];
				
				if(achType === "1") {
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
						let backfills = [];

						listenersToAward.forEach(listener => {
							backfills.push(addToEarned(req, foundUser, foundChannel, {uid: listener.aid}, false, false));
						});

						Promise.all(backfills).then(backfilled => {
							let awarded = false;

							backfilled.forEach(backfill => {
								if(backfill) {
									awarded = backfill;
								}
							});

							if(awarded && tier && foundUser._id) {
								new Notice({
									user: foundUser._id,
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
										user: foundUser.name
									});
								});
							}
						})
					}
				} else {
					//The achievement wasn't a resub
				}
			}
		}
	});
}

module.exports = router;