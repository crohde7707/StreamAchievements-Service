const router = require('express').Router();
const passport = require('passport');
const uuid = require('uuid/v1');
const {isAuthorized, isModAuthorized, isAdminAuthorized} = require('../utils/auth-utils');
const mongoose = require('mongoose');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validDataUrl = require('valid-data-url');

const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Image = require('../models/image-model');
const Token = require('../models/token-model');
const Queue = require('../models/queue-model');
const Notice = require('../models/notice-model');
const {uploadImage, destroyImage} = require('../utils/image-utils');
const {emitNewChannel, emitOverlaySettingsUpdate, emitOverlayAlert} = require('../utils/socket-utils');

const DEFAULT_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png";
const HIDDEN_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811887/hidden-icon.png";

const imgURLRegex = /^https:\/\/res\.cloudinary\.com\/phirehero\/.*\.(png|jpg|jpeg)$/gm;

const DEFAULT_OVERLAY_CONFIG = require('../configs/default-overlay-configs');

const RETRIEVE_LIMIT = 15;

router.get("/create", isAuthorized, (req, res) => {
	Channel.findOne({twitchID: req.user.twitchID}).then((existingChannel) => {
		if(existingChannel) {
			res.json({
				error: 'Channel already exists!',
				channel: existingChannel
			});
		} else {
			new Channel({
				owner: req.user.name,
				twitchID: req.user.twitchID,
				theme: '',
				logo: req.user.logo,
				achievements: [],
				members: [],
				icons: {
					default: DEFAULT_ICON,
					hidden: HIDDEN_ICON
				},
				oid: uuid(),
				nextUID: 1
			}).save().then((newChannel) => {
				let fullAccess = false;

				if(req.user.integration && req.user.integration.patreon && (req.user.integration.patreon.type === 'forever' || req.user.integration.patreon.is_gold)) {
					fullAccess = true;
				}

				emitNewChannel({
					name: req.user.name,
					'full-access': fullAccess,
					online: false
				});
				
				req.user.channelID = newChannel.id;
				req.user.save().then((savedUser) => {
					res.json({
						channel: newChannel,
						user: req.user
					});
				});
				
			});		
		}
	});
});

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

router.post('/join', isAuthorized, (req, res) => {
	Channel.findOne({owner: req.body.channel}).then((existingChannel) => {
		if(existingChannel) {
			let joinedChannels = req.user.channels;

			let alreadyJoined = joinedChannels.some((channel) => (channel.channelID === existingChannel.id));
			let memberAlready = existingChannel.members.includes(req.user.id);

			if(alreadyJoined) {
				//This channel already joined by user
				if(!memberAlready) {
					existingChannel.members.push(req.user.id);
					existingChannel.save().then((savedChannel) => {
						res.json({
							user: req.user,
							channel: savedChannel
						});
					})
				} else {
					res.json({
						user: req.user,
						channel: existingChannel
					});
				}
			} else if(memberAlready) {			
				if(!alreadyJoined) {
					req.user.channels.push({
						channelID: existingChannel.id,
						achievements: [],
						sync: true
					});
					req.user.save().then((savedUser) => {
						res.json({
							user: savedUser,
							channel: existingChannel
						});
					});
				} else {
					res.json({
						user: req.user,
						channel: existingChannel
					});
				}
			} else {
				let newChannelObj = {
					channelID: existingChannel.id,
					achievements: [],
					sync: true
				};
				console.log('checking queues...');

				Queue.find({twitchID: req.user.integration.twitch.etid, channelID: existingChannel.id}).then(queues => {
					if(queues) {
						console.log('Giving achievements to ' + req.user.name);
						queues.forEach(ach => {

							console.log('awarding ' + ach.achievementID);
							
							newChannelObj.achievements.push({
								aid: ach.achievementID,
								earned: ach.earned || new Date()
							});

							Queue.deleteOne({ _id: ach.id}).then(err => {
								console.log(err);
							});
						});
						console.log('---------------');
					}


					req.user.channels.push(newChannelObj);
					req.user.save().then((savedUser) => {

						existingChannel.members.push(savedUser.id);
						existingChannel.save().then((savedChannel) => {

							res.json({
								user: savedUser,
								channel: savedChannel
							});
						});
					});
				});
			}
		} else {
			res.status(405);
			res.send('Channel requested to join does not exist!');
		}
	});
});

router.get('/list', (req, res) => {
	Channel.find({}, (err, channels) => {
		res.json(channels);
	});
});

router.get('/retrieve', isAuthorized, (req, res) => {
	let channel = req.query.channel;
	let bb = req.query.bb;

	if(bb) {
		//gather channels to be watched
		Channel.find({watcher: true}).then(foundChannels => {
			let channelObj = {};

			foundChannels.map((channel) => {
				return {
					name: channel.owner,
					listeners: channel.listeners
				}
			});
		})
	}

	if(channel) {
		let favorited = false;

		Channel.findOne({owner: channel}).then((foundChannel) => {
			if(foundChannel) {
				
				if(req.user.favorites) {

					let favIdx = req.user.favorites.findIndex(fav => fav === foundChannel.id);
					
					if(favIdx >= 0) {
						favorited = true;
					}
				}

				Achievement.find({channel: channel}).then((foundAchievements) => {

					let joined = foundChannel.members.includes(req.user.id);
					let earned, retAchievements;

					if(joined) {
						let channelIDX = req.user.channels.findIndex((channel) => {
							return (channel.channelID === foundChannel.id)
						});

						let earnedAchievements = req.user.channels[channelIDX].achievements;

						//Clean up deleted achievements

						let foundMap = {};

						let cleanedUpAchievements = earnedAchievements.filter((ach, idx) => {
							let filtered = foundAchievements.findIndex(fach => {
						        return fach.uid === ach.aid
						    });

							if(filtered >= 0 && !foundMap[ach.aid]) {
								//achievement found
								foundMap[ach.aid] = true;
								return true;
							} else {
								return false;
							}

						});

						if(cleanedUpAchievements.length !== earnedAchievements.length) {
							req.user.channels[channelIDX].achievements = cleanedUpAchievements;
							req.user.save();
							console.log('synced achievements...');
							earnedAchievements = cleanedUpAchievements;
						}

						earned = earnedAchievements.map(achievement => achievement.aid);

						retAchievements = foundAchievements.map(achievement => {
							let ach = Object.assign({}, achievement._doc);

							let aIdx = earned.findIndex(aid => aid === ach.uid);

							if(aIdx >= 0) {
								ach.earned = earnedAchievements[aIdx].earned;
							}

							return ach
						})
					} else {
						retAchievements = foundAchievements;
					}

					let strippedAchievements = retAchievements.map(ach => {
						let tempAch = (ach['_doc']) ? {...ach['_doc']} : ach;
						delete tempAch['__v'];
						delete tempAch['_id'];

						return tempAch;
					});

					strippedAchievements.sort((a, b) => (a.order > b.order) ? 1 : -1);

					//check if patreon active, return full access or not
					User.findOne({name: channel}).then((foundUser) => {
						if(foundUser) {
							let fullAccess = false;

							if(foundUser.integration.patreon && foundUser.integration.patreon.is_gold) {
								fullAccess = true;
							}

							let retChannel = {...foundChannel['_doc']};
							delete retChannel['__v'];
							delete retChannel['_id'];

							res.json({
								channel: retChannel,
								achievements: strippedAchievements,
								joined: joined,
								fullAccess,
								favorited
							});	
						} else {
							res.json({
								error: "Channel doesn't exist"
							});
						}
					});
				});	
				
			} else {
				res.json({
					error: "No channel found for the name: " + channel
				});
			}
		});
	}
});

router.get('/dashboard', isAuthorized, (req, res) => {

	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		if(existingChannel) {

			let achievementsPromise = new Promise((resolve, reject) => {
				Achievement.find({channel: existingChannel.owner}).then((achievements) => { 

					if(achievements) {
						let listenerIds = achievements.map(achievement => {
							return achievement.listener
						});

						Listener.find({'_id': { $in: listenerIds}}).then((listeners) => {

							let mergedAchievements = achievements.map(achievement => {
								
								let listenerData = listeners.find(listener => {
									return listener.id === achievement.listener;
								});
								
								if(listenerData) {

									let merge = {
										"_id": achievement['_id'],
										uid: achievement.uid,
										channel: achievement.owner,
										title: achievement.title,
										description: achievement.description,
										icon: achievement.icon,
										earnable: achievement.earnable,
										limited: achievement.limited,
										secret: achievement.secret,
										listener: achievement.listener,
										code: listenerData.code,
										order: achievement.order
									}
									
									if(listenerData.resubType) {
										merge.resubType = listenerData.resubType;
									}
									if(listenerData.query) {
										merge.query = listenerData.query;
									}
									
									return merge;
								} else {
									return achievement;
								}
							});

							mergedAchievements.sort((a, b) => (a.order > b.order) ? 1 : -1);

							resolve(mergedAchievements);
						});
					} else {
						resolve(achievements);
					}
				});	
			});

			let imagesPromise = new Promise((resolve, reject) => {
				//Get Images
				Image.find({channel: existingChannel.owner}).then(foundImages => {
					if(foundImages) {
						resolve({
							gallery: foundImages
						})
					} else {
						resolve({
							gallery: []
						});
					}
				});
			});

			let moderatorsPromise = new Promise((resolve, reject) => {

				let moderatorIds = existingChannel.moderators.map(moderator => moderator.uid);

				User.find({'_id': { $in: moderatorIds}}).then(moderators => {
					let resModerators = moderators.map(moderator => {

						let mod = existingChannel.moderators.find(channelMod => channelMod.uid === moderator.id);

						return {
							id: moderator.id,
							name: moderator.name,
							logo: moderator.logo,
							permissions: mod.permissions
						}
					});

					resolve(resModerators);
				})
			})

			Promise.all([achievementsPromise, imagesPromise, moderatorsPromise]).then(values => {
				let retChannel;

				if(!existingChannel.oid) {
					existingChannel.oid = uuid();
					if(!existingChannel.overlay || Object.keys(existingChannel.overlay).length === 0) {
						existingChannel.overlay = DEFAULT_OVERLAY_CONFIG;
					}
					existingChannel.save().then(savedChannel => {
						retChannel = {...savedChannel['_doc']};
						delete retChannel['__v'];
						delete retChannel['_id'];

						res.json({
							channel: retChannel,
							achievements: values[0],
							images: values[1],
							moderators: values[2]
						});
					});
				} else if(!existingChannel.overlay || Object.keys(existingChannel.overlay).length === 0) {
					
					existingChannel.overlay = DEFAULT_OVERLAY_CONFIG;
					existingChannel.save().then(savedChannel => {
						retChannel = {...savedChannel['_doc']};
						delete retChannel['__v'];
						delete retChannel['_id'];

						res.json({
							channel: retChannel,
							achievements: values[0],
							images: values[1],
							moderators: values[2]
						});
					})
				} else {
					retChannel = {...existingChannel['_doc']};
					delete retChannel['__v'];
					delete retChannel['_id'];

					res.json({
						channel: retChannel,
						achievements: values[0],
						images: values[1],
						moderators: values[2]
					});
				}
			});
			
		} else {
			res.json({
				error: 'User doesn\'t manage a channel'
			});
		}	
	});
})

router.post('/mod', isAuthorized, (req, res) => {
	let mods = req.body.mods;
	let retMods = [];

	Channel.findOne({owner: req.user.name}).then(existingChannel => {
		User.find({'name': { $in: mods}}).then(foundMembers => {
		
			let moderators = existingChannel.moderators;

			foundMembers.forEach(mod => {
				moderators.push({
					uid: mod.id,
					permissions: {
						channel: true,
						chat: true
					}
				});

				retMods.push({
					name: mod.name,
					logo: mod.logo,
					permissions: {
						channel: true,
						chat: true
					}
				})
			});

			existingChannel.moderators = moderators;

			existingChannel.save().then(savedChannel => {
				res.json({
					moderators: retMods
				});
			});
		});
	})
});

router.post('/mod/revoke', isAuthorized, (req, res) => {
	let mod = req.body.mod;

	Channel.findOne({owner: req.user.name}).then(existingChannel => {
		if(existingChannel) {
			User.findOne({'name': mod}).then(foundMod => {
				if(foundMod) {

					let channelMods = existingChannel.moderators;

					let modIndex = channelMods.findIndex(moderator => moderator.uid === foundMod.id);

					if(modIndex >= 0) {
						channelMods.splice(modIndex, 1);

						existingChannel.moderators = channelMods;

						existingChannel.save().then(savedChannel => {
							res.json({
								removed: modIndex
							});
						});
					} else {
						res.json({
							error: 'Error removing mod'
						});
					}
				}
			});	
		}
	})
})

router.post('/update', isAuthorized, (req, res) => {
	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then((existingChannel) => {
		if(existingChannel) {
			//grab updates from body

			//upload image to cloudinary if upload is needed

			//update 
		} else {

		}
	})
});

router.post('/mod/preferences', isModAuthorized, (req, res) => {
	updateChannelPreferences(req, res, req.channel);
});

router.post('/preferences', isAuthorized, (req, res) => {
	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then(existingChannel => {
		if(existingChannel) {
			updateChannelPreferences(req, res, existingChannel);
		} else {
			res.json({
				error: 'Issue updating preferences'
			});
		}
	});
});

let updateChannelPreferences = (req, res, existingChannel) => {
	let defaultPromise, hiddenPromise, overlayPromise;
		//upload images if needed
	defaultPromise = new Promise((resolve, reject) => {
		if(req.body.defaultIcon && validDataUrl(req.body.defaultIcon)) {
			//got an image to upload
			uploadImage(req.body.defaultIcon, req.body.defaultIconName, existingChannel.owner, 'default').then(iconImg => {
				resolve(iconImg.url);
			});
		} else if(req.body.defaultImage && imgURLRegex.test(req.body.defaultImage)) {
			resolve(req.body.defaultImage);
		} else {
			resolve();
		}
	});

	hiddenPromise = new Promise((resolve, reject) => {
		if(req.body.hiddenIcon && validDataUrl(req.body.hiddenIcon)) {
			//got an image to upload
			uploadImage(req.body.hiddenIcon, req.body.hiddenIconName, existingChannel.owner, 'hidden').then(iconImg => {
				resolve(iconImg.url);
			});
		} else if(req.body.hiddenImage && imgURLRegex.test(req.body.hiddenImage)) {
			resolve(req.body.hiddenImage);
		} else {
			resolve();
		}
	});

	overlayPromise = new Promise((resolve, reject) => {
		if(req.body.overlay) {
			let {chat, chatMessage, sfx, enterEffect, exitEffect, duration, volume, delay} = req.body.overlay;
			let overlay = existingChannel.overlay || {};

			if(chat) {
				overlay.chat = chat;
			}

			if(chatMessage !== undefined) {
				overlay.chatMessage = chatMessage;
			}

			if(sfx) {
				overlay.sfx = process.env.WEB_DOMAIN + 'sounds/achievement.' + sfx + '.mp3';
			}

			if(enterEffect) {
				overlay.enterEffect = enterEffect;
			}

			if(exitEffect) {
				overlay.exitEffect = exitEffect;
			}

			if(duration) {
				overlay.duration = duration
			}

			if(volume) {
				overlay.volume = volume
			}

			if(delay) {
				overlay.delay = delay;
			}

			resolve(overlay);
		} else {
			resolve();
		}
	});

	Promise.all([defaultPromise, hiddenPromise, overlayPromise]).then((results) => {

		let iconsUpdate = {
			default: existingChannel.icons.default,
			hidden: existingChannel.icons.hidden
		};

		if(results[0]) {
			iconsUpdate.default = results[0];
		}

		if(results[1]) {
			iconsUpdate.hidden = results[1];
		}

		if(results[2]) {
			existingChannel.overlay = results[2];
			updateSettings = true;
		}

		existingChannel.icons = iconsUpdate;

		existingChannel.save().then(savedChannel => {

			if(results[0] !== savedChannel.icons.default) {
				console.log('uh oh');
			}

			if(updateSettings) {
				emitOverlaySettingsUpdate(req, {
					channel: savedChannel.owner,
					overlay: savedChannel.overlay
				});
			}

			Image.find({channel: existingChannel.owner}).then(foundImages => {
				if(foundImages) {
					res.json({
						channel: savedChannel,
						images: {
							gallery: foundImages
						}
					});
				} else {
					res.json({
						channel: savedChannel
					});
				}
			});
		});
	});
}

router.post('/image', isAuthorized, (req, res) => {
	//delete image from Cloudinary
	let image = req.body.image;

	destroyImage(image.cloudID).then(result => {

		let channelUpdatePromise;
		
		//if image part of achievement, delete off achievement
		let achievementPromise = new Promise((resolve, reject) => {
			if(image.achievementID !== '') {
				Achievement.findOne({['_id']: image.achievementID}).then(foundAchievement => {
					if(foundAchievement) {
						foundAchievement.icon = '';
						foundAchievement.save().then(() => {
							Achievement.find({channel: req.user.name}).then((achievements) => {
								resolve(achievements);
							}); 
						});
					} else {
						resolve();
					}
				});
			} else {
				resolve();
			}
		});

		//delete image from image table
		let imagePromise = new Promise((resolve, reject) => {
			Image.deleteOne({['_id']: image['_id']}).then(err => {
				//Get Images				
				Image.find({channel: req.user.name}).then(foundImages => {
					console.log("\nGetting all images after delete");
					if(foundImages) {
						resolve({
							gallery: foundImages,
							default: ""
						});
					} else {
						resolve({
							gallery: [],
							default: ""
						});
					}
				});
			});
		});

		if(image.type === 'hidden' || image.type === 'default') {

			channelUpdatePromise = new Promise((resolve, reject) => {
				//delete image from channel
				Channel.findOne({twitchID: req.user.integration.twitch.etid}).then(existingChannel => {
					
					let icons = {...existingChannel.icons};
					if(image.type === 'default') {
						icons.default = DEFAULT_ICON
					} else if(image.type === 'hidden') {
						icons.hidden = HIDDEN_ICON
					}
					existingChannel.icons = icons;
					existingChannel.save().then(savedChannel => {
						resolve(savedChannel);
					});
				});
			});
			
		} else {
			channelUpdatePromise = Promise.resolve();
		}

		Promise.all([achievementPromise, imagePromise, channelUpdatePromise]).then(values => {

			let responseObj = {
				images: values[1]
			};

			if(values[0]) {
				responseObj.achievements = values[0];
			}

			if(values[2]) {
				responseObj.channel = values[2];
			}

			res.json(responseObj);
		});
	});
});

router.get("/user", isAuthorized, (req, res) => {

	let favLookup = {};
	let favChannels, otherChannels, offset;

	if(req.user.favorites) {
		req.user.favorites.forEach(fav => {
			favLookup[fav] = true;
		});
	}

	let favArray = req.user.favorites.map(channel => new mongoose.Types.ObjectId(channel));
	
	let channelArray = req.user.channels.filter(channel => !req.user.favorites.includes(channel.channelID)).map(channel => new mongoose.Types.ObjectId(channel.channelID));
	
	let favPromise = new Promise((resolve, reject) => {
		Channel.find({'_id': { $in: favArray}}).exec((err, channels) => {

			let channelResponse = [];

			let promises = channels.map(channel => {
				let earnedAchievements = req.user.channels.find(userChannel => (userChannel.channelID === channel.id));
				let percentage = 0;

				return new Promise((resolve2, reject) => {
					Achievement.countDocuments({channel: channel.owner}).then(count => {

						if(count > 0) {
							percentage = Math.round((earnedAchievements.achievements.length / count) * 100);
						}

						resolve2({
				     		logo: channel.logo,
				     		owner: channel.owner,
				     		percentage: percentage,
				     		favorite: true
				     	});
				    });
				});
			});

			Promise.all(promises).then(channels => {

				favChannels = channels;

				resolve();
			});
		});
	});

	let otherPromise = new Promise((resolve, reject) => {
		Channel.find({'_id': { $in: channelArray}}).limit(RETRIEVE_LIMIT).exec((err, channels) => {

			let channelResponse = [];

			let promises = channels.map(channel => {
				let earnedAchievements = req.user.channels.find(userChannel => (userChannel.channelID === channel.id));
				let percentage = 0;

				return new Promise((resolve2, reject) => {
					Achievement.countDocuments({channel: channel.owner}).then(count => {

						if(count > 0) {
							percentage = Math.round((earnedAchievements.achievements.length / count) * 100);
						}

						resolve2({
				     		logo: channel.logo,
				     		owner: channel.owner,
				     		percentage: percentage,
				     		favorite: false
				     	});
				    });
				});
			});

			Promise.all(promises).then(channels => {
				otherChannels = channels;

				if(channels.length < req.user.channels.length) {
					offset = channels.length
				} else {
					offset = -1
				}
				
				resolve();
			});
		});
	});

	Promise.all([favPromise, otherPromise]).then(done => {
		res.json({
			channels: favChannels.concat(otherChannels),
			offset
		});
	});
});

router.get("/member/retrieve", isAuthorized, (req, res) => {
	let offset = parseInt(req.query.offset);

	getMembersOffset(req, res, offset).then(data => {
		console.log(data.members.length + offset);
		console.log(data.channel.members.length);
		if(data.members.length + offset < data.channel.members.length) {
			offset = data.members.length + offset
		} else {
			offset = -1
		}

		res.json({
			members: data.members,
			offset
		});
	})
});

let getMembersOffset = (req, res, offset) => {
	return new Promise((resolve, reject) => {
		Channel.findOne({'owner': req.user.name}).then(foundChannel => {
			if(foundChannel) {
				let memberArray = foundChannel.members;

				User.find({'_id': { $in: memberArray}}).sort({'name': 1}).skip(offset).limit(RETRIEVE_LIMIT).exec((err, members) => {

					let retMembers = members.map(member => {
						let channelInfo = member.channels.find(channel => channel.channelID === foundChannel.id);

						return {
							name: member.name,
							logo: member.logo,
							achievementsEarned: channelInfo.achievements.map((achievement => achievement.aid))
						}
					});

					resolve({
						members: retMembers,
						channel: foundChannel
					});
				});
			} else {
				reject();
			}
		});
	});
}

router.get("/user/retrieve", isAuthorized, (req, res) => {
	let offset = parseInt(req.query.offset);

	let channelArray = req.user.channels.filter(channel => !req.user.favorites.includes(channel.channelID)).map(channel => new mongoose.Types.ObjectId(channel.channelID));

	Channel.find({'_id': { $in: channelArray}}).skip(offset).limit(RETRIEVE_LIMIT).exec((err, channels) => {
		let promises = channels.map(channel => {
			let earnedAchievements = req.user.channels.find(userChannel => (userChannel.channelID === channel.id));
			let percentage = 0;

			return new Promise((resolve, reject) => {
				Achievement.countDocuments({channel: channel.owner}).then(count => {

					if(count > 0) {
						percentage = Math.round((earnedAchievements.achievements.length / count) * 100);
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
})

router.post("/signup", isAuthorized, (req, res) => {
	//generate code
	let uid = req.body.uid;

	let token = new Token({uid: req.user._id, token: 'not issued'});

	let generatedToken = crypto.randomBytes(16).toString('hex');
	
	token.token = generatedToken;
	token.created = Date.now();
	token.save().then(savedToken => {

		let email = req.user.email;

		var auth = {
		    type: 'oauth2',
		    user: process.env.GML,
		    clientId: process.env.GMLCID,
		    clientSecret: process.env.GMLCS,
		    refreshToken: process.env.GMLRT
		};

		var transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: auth
		});

		const mailOptions = {
		    from: process.env.GML, // sender address
		    to: email, // list of receivers
		    subject: 'Your Confirmation Code!', // Subject line
		    html: '<div style="background:#222938;padding-bottom:30px;"><h1 style="text-align:center;background:#2f4882;padding:15px;margin-top:0;"><img style="max-width:600px;" src="https://res.cloudinary.com/phirehero/image/upload/v1557947921/sa-logo.png" /></h1><h2 style="color:#FFFFFF; text-align: center;margin-top:30px;margin-bottom:25px;font-size:22px;">Thank you for your interest in Stream Achievements!</h2><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">You are ready to start creating achievements that your community will be able to hunt for and earn!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">To get started, all you need to do is <a style="color: #ecdc19;" href="http://streamachievements.com/channel/verify?id=' + generatedToken + '&utm_medium=Email">verify your account</a>, and you\'ll be all set!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We are truly excited to see what you bring in terms of achievements, and can\'t wait to see how much your community engages and enjoys them!</p></div>'
		};

		transporter.sendMail(mailOptions, function (err, info) {
		   if(err)
		     console.log(err)
		   else

		   	new Notice({
				user: req.user._id,
				logo: DEFAULT_ICON,
				message: "Your channel is ready to begin! Go check your email for your confirmation code, and don't forget to check your spam folder!",
				date: Date.now(),
				type: 'confirmation',
				status: 'new'
			}).save().then(savedNotice => {
				console.log(savedNotice);
			});

		    res.json({
		    	message: "email sent"
		    });
		});

	});
});

router.post('/queue', isAdminAuthorized, (req, res) => {
	let uid = req.body.uid;

	Token.deleteOne({uid}).then(err => {
		User.findById(uid).then(foundUser => {
			let email = foundUser.email;
			var transporter = nodemailer.createTransport({
				service: 'gmail',
				auth: {
					user: process.env.GML,
					pass: process.env.GMLP
				}
			});

			const mailOptions = {
			    from: 'Stream Achievements <' + process.env.GML + '>', // sender address
			    to: email, // list of receivers
			    subject: 'Info on your request!', // Subject line
			    html: '<h1>Thank you for your interest in Stream Achievements!</h1><p>We reviewed your channel and have placed you in the queue as we slowly add people to the system! We want to ensure the best experience for streamer and viewer alike, so we are taking every percaution to have a top performing app!</p><p>Keep an eye on your email / notifications, and the moment you are added, you will be send a confirmation code to enter on the site!</p><p>Thank you again for wanting to join in on the fun, can\'t wait to have you join us!</p>'// plain text body
			};
		});
	});
});

router.post('/confirm', isAdminAuthorized, (req, res) => {

	User.findOne({name: req.body.name}).then(foundMember => {
		let uid = foundMember['_id'];

		Token.findOne({uid}).then(foundToken => {
			let generatedToken = crypto.randomBytes(16).toString('hex');
			foundToken.token = generatedToken;
			foundToken.created = Date.now();
			foundToken.save().then(savedToken => {
				
				let email = foundMember.email;

				var auth = {
				    type: 'oauth2',
				    user: process.env.GML,
				    clientId: process.env.GMLCID,
				    clientSecret: process.env.GMLCS,
				    refreshToken: process.env.GMLRT
				};

				var transporter = nodemailer.createTransport({
					service: 'gmail',
					auth: auth
				});

				const mailOptions = {
				    from: process.env.GML, // sender address
				    to: email, // list of receivers
				    subject: 'Your Confirmation Code!', // Subject line
				    html: '<div style="background:#222938;padding-bottom:30px;"><h1 style="text-align:center;background:#2f4882;padding:15px;margin-top:0;"><img style="max-width:600px;" src="https://res.cloudinary.com/phirehero/image/upload/v1557947921/sa-logo.png" /></h1><h2 style="color:#FFFFFF; text-align: center;margin-top:30px;margin-bottom:25px;font-size:22px;">Thank you for your interest in Stream Achievements!</h2><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We reviewed your channel and feel you are a perfect fit to join in on this pilot, and test the new features we aim to provide for streamers!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">To get started, all you need to do is <a style="color: #ecdc19;" href="http://streamachievements.com/channel/verify?id=' + generatedToken + '&utm_medium=Email">verify your account</a>, and you\'ll be all set!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We are truly excited to see what you bring in terms of Achievements, and can\'t wait to see how much your community engages!</p></div>'
				};

				transporter.sendMail(mailOptions, function (err, info) {
				   if(err)
				     console.log(err)
				   else

				   	new Notice({
						user: uid,
						logo: DEFAULT_ICON,
						message: "Your channel has been approved! Go check your email for your confirmation code! Don't forget to check your spam folder, too!",
						date: Date.now(),
						type: 'confirmation',
						status: 'new'
					}).save().then(savedNotice => {
						console.log(savedNotice);
					});

				    res.json({
				    	message: "email sent"
				    });
				});
			});
		});
	});
});

router.post('/verify', isAuthorized, (req, res) => {
	let token = req.body.id;

	Token.findOne({uid: req.user._id, token}).then(foundToken => {
		if(foundToken) {
			if(foundToken.hasExpired()) {
				Token.deleteOne({uid: req.user._id, token}).then(err => {
					res.json({
						expired: true
					});	
				});
				
				res.json({
					expired: true
				});
			} else {
				let type = req.user.broadcaster_type;

				new Channel({
					owner: req.user.name,
					twitchID: req.user.integration.twitch.etid,
					theme: '',
					logo: req.user.logo,
					members: [],
					moderators: [],
					icons: {
						default: DEFAULT_ICON,
						hidden: HIDDEN_ICON
					},
					oid: uuid(),
					overlay: DEFAULT_OVERLAY_CONFIG,
					nextUID: 1,
					broadcaster_type: {
						twitch: type
					}
				}).save().then((newChannel) => {

					new Notice({
						user: process.env.NOTICE_USER,
						logo: newChannel.logo,
						message: `${newChannel.owner} just created their channel!`,
						date: Date.now(),
						type: 'confirmation',
						status: 'new'
					}).save();

					req.user.type = 'verified';
					req.user.save().then((savedUser) => {
						Token.deleteOne({uid: req.user._id, token}).then(err => {
							res.json({
								verified: true
							});	
						})
					});
				});
			}
		} else {
			res.json({
				error: 'Unauthorized'
			});
		}
	})
});

router.get('/overlay', (req, res) => {
	let oid = req.query.id;

	Channel.findOne({oid: oid}).then(foundChannel => {
		if(foundChannel) {
			
			res.json({
				overlay: foundChannel.overlay,
				icons: foundChannel.icons
			});
		}
	});
})

router.get('/testOverlay', isAuthorized, (req, res) => {
	emitOverlayAlert(req, {
		user: req.user.name,
		channel: req.user.name,
		title: 'Test Achievement',
		icon: 'https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png',
		unlocked: true
	});

	res.json({});
})

router.post('/reorder', isAuthorized, (req, res) => {
	let reqAchievements = req.body.achievements;

	if(reqAchievements) {

		let achLookup = {};

		reqAchievements.forEach(ach => {
			achLookup[ach.uid] = ach.order;
		});

		Achievement.find({channel: req.user.name}).then(foundAchievements => {

			if(foundAchievements) {
				foundAchievements.forEach(achievement => {
					let order = achLookup[achievement.uid];

					if(!achievement.order || achievement.order !== order) {
						achievement.order = order;
						achievement.save();
					}
				});

				res.json({})
			} else {
				res.json({
					error: 'Issue updating achievements. Try again later.'
				});
			}
		});
	} else {
		res.json({
			error: 'Unexpected use of the API'
		});
	}
});

router.post('/favorite', isAuthorized, (req, res) => {
	//for now, only supporting one favorited channel, so just store off that one channel
	let channel = req.body.channel;
	let task = req.body.task;

	Channel.findOne({owner: channel}).then(foundChannel => {
		if(foundChannel) {
			if(task === 'add') {

				req.user.favorites.push(foundChannel.id);

				req.user.save().then(savedUser => {
					res.json({
						favorited: true,
						favorites: savedUser.favorites
					});
				});
			} else if(task === 'remove' && req.user.favorites) {
				var index = req.user.favorites.findIndex(fav => fav === foundChannel.id);

				req.user.favorites.splice(index, 1);

				req.user.save().then(savedUser => {
					res.json({
						favorited: false,
						favorites: savedUser.favorites
					});
				});
			}
			
		} else {
			res.json({
				error: 'Channel doesn\'t exist!'
			});
		}
	})

});

router.get('/mod', isAuthorized, (req, res) => {

	Channel.find({'moderators.uid': req.user._id}).then(channels => {
		
		let retChannels = channels.map(channel => {
			return {
				owner: channel.owner,
				logo: channel.logo
			}
		});

		res.json({
			channels: retChannels
		});
	});

});

router.get('/mod/retrieve', isModAuthorized, (req, res) => {
	retrieveChannel(req, res, req.channel);
});

let retrieveChannel = (req, res, existingChannel) => {
	let achievementsPromise = new Promise((resolve, reject) => {
		Achievement.find({channel: existingChannel.owner}).then((achievements) => { 

			if(achievements) {
				let listenerIds = achievements.map(achievement => {
					return achievement.listener
				});

				Listener.find({'_id': { $in: listenerIds}}).then((listeners) => {

					let mergedAchievements = achievements.map(achievement => {
						
						let listenerData = listeners.find(listener => {
							return listener.id === achievement.listener;
						});
						
						if(listenerData) {

							let merge = {
								"_id": achievement['_id'],
								uid: achievement.uid,
								channel: achievement.owner,
								title: achievement.title,
								description: achievement.description,
								icon: achievement.icon,
								earnable: achievement.earnable,
								limited: achievement.limited,
								secret: achievement.secret,
								listener: achievement.listener,
								code: listenerData.code,
								order: achievement.order
							}
							
							if(listenerData.resubType) {
								merge.resubType = listenerData.resubType;
							}
							if(listenerData.query) {
								merge.query = listenerData.query;
							}
							
							return merge;
						} else {
							return achievement;
						}
					});

					mergedAchievements.sort((a, b) => (a.order > b.order) ? 1 : -1);

					resolve(mergedAchievements);
				});
			} else {
				resolve(achievements);
			}
		});	
	});

	Promise.all([achievementsPromise]).then(values => {
		let retChannel;

		if(!existingChannel.oid) {
			existingChannel.oid = uuid();
			if(!existingChannel.overlay || Object.keys(existingChannel.overlay).length === 0) {
				existingChannel.overlay = DEFAULT_OVERLAY_CONFIG;
			}
			existingChannel.save().then(savedChannel => {
				retChannel = {...savedChannel['_doc']};
				delete retChannel['__v'];
				delete retChannel['_id'];

				res.json({
					channel: retChannel,
					achievements: values[0]
				});
			});
		} else if(!existingChannel.overlay || Object.keys(existingChannel.overlay).length === 0) {
			
			existingChannel.overlay = DEFAULT_OVERLAY_CONFIG;
			existingChannel.save().then(savedChannel => {
				retChannel = {...savedChannel['_doc']};
				delete retChannel['__v'];
				delete retChannel['_id'];

				res.json({
					channel: retChannel,
					achievements: values[0]
				});
			})
		} else {
			retChannel = {...existingChannel['_doc']};
			delete retChannel['__v'];
			delete retChannel['_id'];

			res.json({
				channel: retChannel,
				achievements: values[0]
			});
		}
	});
}

module.exports = router;