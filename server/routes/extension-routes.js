const router = require('express').Router();
const passport = require('passport');
const uuid = require('uuid/v1');
const {isAuthorized, isModAuthorized, isAdminAuthorized, isExtensionAuthorized} = require('../utils/auth-utils');
const mongoose = require('mongoose');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validDataUrl = require('valid-data-url');
const axios = require('axios');

const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Image = require('../models/image-model');
const Token = require('../models/token-model');
const Notice = require('../models/notice-model');
const Earned = require('../models/earned-model');
const {uploadImage, destroyImage} = require('../utils/image-utils');
const {emitNewChannel, emitOverlaySettingsUpdate, emitOverlayAlert, emitNotificationsUpdate} = require('../utils/socket-utils');

const DEFAULT_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png";
const HIDDEN_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811887/hidden-icon.png";

const imgURLRegex = /^https:\/\/res\.cloudinary\.com\/phirehero\/.*\.(png|jpg|jpeg)$/gm;

const DEFAULT_OVERLAY_CONFIG = require('../configs/default-overlay-configs');

const RETRIEVE_LIMIT = 15;

router.post('/leave', isAuthorized, (req, res) => {
	Channel.findOne({owner: req.body.channel}).then((existingChannel) => {
		if(existingChannel) {

			let members = existingChannel.members;
			let i;

			if(members.length > 0 && members.includes(req.user.id)) {

				i = members.findIndex((member) => {
					member === req.user.id
				});

				members.splice(i, 1);

				existingChannel.save().then((savedChannel) => {
					//Remove channel from user
					i = 0;

					i = req.user.channels.findIndex((channel) => {
						return channel.channelID === savedChannel.id
					});
						
					req.user.channels.splice(i, 1);

					req.user.save().then((savedUser) => {
						res.json({
							leave: true
						});
					});
				});
			} else {
				res.send("User isn't a part of this channel");
			}
		} else {
			res.send("Channel doesn't exist");
		}
	});
});

router.post('/join', isExtensionAuthorized, (req, res) => {
	let user = req.user.user;
	
	joinChannel(req, res, user);
});

router.get('/retrieve', isExtensionAuthorized, async (req, res) => {
	let channelID = req.query.channelID;
	let member = ((req.user.exists) ? req.user.user : undefined);
	
	if(channelID) {
		let favorited = false;

		let foundUser = await User.findOne({'integration.twitch.etid': channelID});

		if(foundUser) {

			let foundChannel = await Channel.findOne({owner: foundUser.name});
				
			if(foundChannel) {

				if(member) {
					if(req.user.favorites) {

						let favIdx = member.favorites.findIndex(fav => fav === foundChannel.id);
						
						if(favIdx >= 0) {
							favorited = true;
						}
					}

					let foundAchievements = await Achievement.find({channel: foundChannel.owner});

					let joined = foundChannel.members.includes(member.id);
					let earned, retAchievements, banned;

					let channelIDX = member.channels.findIndex((channel) => {
						return (channel.channelID === foundChannel.id)
					});

					banned = (channelIDX >= 0) ? member.channels[channelIDX].banned : false;

					let earnedQuery = {
						userID: member.id,
						channelID: foundChannel.id
					};

					if(member.new) {
						earnedQuery.userID = { $in: [member.id, member.integration.twitch.etid]};
					}

					let foundEarneds = await Earned.find(earnedQuery);

					earned = foundEarneds.map(found => {
						return {
							aid: found.achievementID,
							date: found.earned
						}
					});

					retAchievements = foundAchievements.map(achievement => {
						let ach = Object.assign({}, achievement._doc);

						let aIdx = earned.findIndex(a => a.aid === ach.uid);

						if(aIdx >= 0) {
							ach.earned = true;
							ach.earnedDate = earned[aIdx].date;
						} else {
							ach.earned = false;
						}

						return ach
					})

					let strippedAchievements = retAchievements.map(ach => {
						let tempAch = (ach['_doc']) ? {...ach['_doc']} : ach;
						delete tempAch['__v'];
						delete tempAch['_id'];

						return tempAch;
					});

					strippedAchievements.sort((a, b) => (a.order > b.order) ? 1 : -1);

					//check if patreon active, return full access or not
					
					let fullAccess = false;

					if(foundUser.integration.patreon && foundUser.integration.patreon.is_gold) {
						fullAccess = true;
					}

					let retChannel = {...foundChannel['_doc']};
					delete retChannel['__v'];
					delete retChannel['_id'];

					let profile = {};
					profile.logo = member.logo;
					profile.isNew = false;

					res.json({
						channel: retChannel,
						achievements: strippedAchievements,
						joined: joined,
						fullAccess,
						favorited,
						banned,
						profile,
						loggedIn: req.user.loggedIn,
						linked: true
					});	

				} else {

					Achievement.find({channel: foundChannel.owner}).then((foundAchievements) => {

						let joined = false;
						let banned = false;

						let earned, retAchievements, achPromise;

						achPromise = new Promise((resolve, reject) => {

							let earnedQuery = {
								userID: req.user.uid,
								channelID: foundChannel.id
							};

							Earned.find(earnedQuery).then(foundEarneds => {
								earned = foundEarneds.map(found => {
									return {
										aid: found.achievementID,
										date: found.earned
									}
								});

								retAchievements = foundAchievements.map(achievement => {
									let ach = Object.assign({}, achievement._doc);

									let aIdx = earned.findIndex(a => a.aid === ach.uid);

									if(aIdx >= 0) {
										ach.earned = true;
										ach.earnedDate = earned[aIdx].date;
									} else {
										ach.earned = false;
									}

									return ach
								})

								resolve();
							});
						})

						achPromise.then(() => {
							let strippedAchievements = retAchievements.map(ach => {
								let tempAch = (ach['_doc']) ? {...ach['_doc']} : ach;
								delete tempAch['__v'];
								delete tempAch['_id'];

								return tempAch;
							});

							strippedAchievements.sort((a, b) => (a.order > b.order) ? 1 : -1);

							//check if patreon active, return full access or not
							
							let fullAccess = false;

							if(foundUser.integration.patreon && foundUser.integration.patreon.is_gold) {
								fullAccess = true;
							}

							let retChannel = {...foundChannel['_doc']};
							delete retChannel['__v'];
							delete retChannel['_id'];

							let profile = {
								isNew: true
							}

							res.json({
								channel: retChannel,
								achievements: strippedAchievements,
								joined: joined,
								fullAccess,
								favorited,
								banned,
								loggedIn: req.user.loggedIn,
								linked: true,
								profile
							});	
						});
					});	
				}
				
				
				
			} else {
				let profile = {
					isNew: true
				}
				
				if(member) {
					profile.logo = member.logo;
					profile.isNew = false
				}

				res.json({
					channel: false,
					loggedIn: req.user.loggedIn,
					exists: req.user.exists,
					profile
				});
			}
		} else {
			let profile = {
				isNew: true
			}
			
			if(member) {
				profile.logo = member.logo;
				profile.isNew = false
			}
			
			res.json({
				channel: false,
				loggedIn: req.user.loggedIn,
				exists: req.user.exists,
				profile
			});
		}
	}
});

router.post("/user/create", isExtensionAuthorized, (req, res) => {
	if(req.user && req.user.uid) {

		let apiURL = `https://api.twitch.tv/helix/users/?id=${req.user.uid}`;

		userPromise = new Promise((resolve, reject) => {
			axios.get(apiURL, {
				headers: {
					'Client-ID': process.env.TCID
				}
			}).then(res => {

				if(res.data && res.data.data && res.data.data[0]) {
					let userID = res.data.data[0].id;
					let name = res.data.data[0].login;
					let logo = res.data.data[0]['profile_image_url'];
					let broadcaster_type = res.data.data[0]['broadcaster_type'];

					new User({
						name: name,
						logo: logo,
						type: 'user',
						channels: [],
						integration: {
							twitch: {
								etid: userID
							}
						},
						preferences: {
							autojoin: true
						},
						new: false
					}).save().then((newUser) => {
						resolve(newUser);
					});		
				}
			});
		});

		userPromise.then(newUser => {

			//Migrate earned achievements
			Earned.find({userID: newUser.integration.twitch.etid}).then(foundEarned => {
				if(foundEarned.length > 0) {
					
					let channels = foundEarned.map(found => found.channelID);
					
					Channel.find({'_id': { $in: channels}}).then(foundChannels => {

						let promises = foundEarned.map(earned => {
							return new Promise((resolve, reject) => {
								earned.userID = newUser.id;
								earned.save().then(() => {
									resolve();
								});
							})
						})

						Promise.all(promises).then(() => {
							res.json({
								logo: newUser.logo
							});
						})
					});

				} else {
					//No achievements earned
					res.json({
						logo: newUser.logo
					});
				}
			});
		})
	} else {
		if(req.user && req.user.user) {
			res.json({
				logo: req.user.user.logo
			});
		}
	}
});

router.post('/user/catch', isExtensionAuthorized, (req, res) => {
	let user = req.user.user;

	if(user.preferences.autojoin !== req.body.autojoin) {
		user.preferences.autojoin = req.body.autojoin;
		user.save().then(savedUser => {
			if(savedUser.preferences.autojoin) {
				joinChannel(req, res, savedUser);
			} else {
				res.json({
					joined: false
				});
			}
		});
	} else if(user.preferences.autojoin) {
		joinChannel(req, res, user);
	}
});

let joinChannel = (req, res, user) => {

	Channel.findOne({twitchID: req.body.channel}).then((existingChannel) => {
		if(existingChannel) {
			let joinedChannels = user.channels;

			let alreadyJoined = joinedChannels.some((channel) => (channel.channelID === existingChannel.id));
			let memberAlready = existingChannel.members.includes(user.id);

			if(alreadyJoined) {
				//This channel already joined by user
				if(!memberAlready) {
					existingChannel.members.push(user.id);
					existingChannel.save().then((savedChannel) => {
						res.json({
							joined: true
						});
					})
				} else {
					res.json({
						joined: true
					});
				}
			} else if(memberAlready) {			
				if(!alreadyJoined) {
					user.channels.push({
						channelID: existingChannel.id,
						sync: true,
						banned: false
					});
					user.save().then((savedUser) => {
						res.json({
							joined: true
						});
					});
				} else {
					res.json({
						joined: true
					});
				}
			} else {
				let newChannelObj = {
					channelID: existingChannel.id,
					sync: true,
					banned: false
				};
				user.channels.push(newChannelObj);
				user.save().then((savedUser) => {

					existingChannel.members.push(savedUser.id);
					existingChannel.save().then((savedChannel) => {

						res.json({
							joined: true
						});
					});
				});
			}
		} else {
			res.status(405);
			res.send('Channel requested to join does not exist!');
		}
	});
}

router.get("/user/retrieve", isAuthorized, (req, res) => {
	let offset = parseInt(req.query.offset);

	let channelArray = req.user.channels.filter(channel => !req.user.favorites.includes(channel.channelID)).map(channel => new mongoose.Types.ObjectId(channel.channelID));

	Channel.find({'_id': { $in: channelArray}}).skip(offset).limit(RETRIEVE_LIMIT).exec((err, channels) => {
		let promises = channels.map(channel => {
			
			let earnedAchievements = req.user.channels.find(userChannel => (userChannel.channelID === channel.id));

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
				     		percentage: percentage,
				     		favorite: false
				     	});
					});
			    });
			});
		});

		Promise.all(promises).then(retChannels => {

			if(retChannels.length + offset < req.user.channels.length) {
				offset = retChannels.length + offset
			} else {
				offset = -1
			}

			res.json({
				channels: retChannels,
				offset
			});
		});
	})
});

module.exports = router;