const router = require('express').Router();
const passport = require('passport');
const uuid = require('uuid/v1');
const {
	isAuthorized,
	isModAuthorized,
	isAdminAuthorized,
	isExtensionAuthorized,
	getTwitchAxiosInstance
} = require('../utils/auth-utils');
const mongoose = require('mongoose');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validDataUrl = require('valid-data-url');
const axios = require('axios');
const { build } = require('../utils/regex-builder');

const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Image = require('../models/image-model');
const Token = require('../models/token-model');
const Notice = require('../models/notice-model');
const Earned = require('../models/earned-model');
const Event = require('../models/event-model');
const {uploadImage, destroyImage} = require('../utils/image-utils');
const {emitNewChannel, emitOverlaySettingsUpdate, emitOverlayAlert, emitNotificationsUpdate, emitDeleteChannel, emitAwardedAchievement} = require('../utils/socket-utils');

const DEFAULT_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png";
const HIDDEN_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811887/hidden-icon.png";

const imgURLRegex = /^https:\/\/res\.cloudinary\.com\/phirehero\/.*\.(png|jpg|jpeg)$/gm;

const DEFAULT_OVERLAY_CONFIG = require('../configs/default-overlay-configs');

const RETRIEVE_LIMIT = 15;

router.post('/delete', isAuthorized, (req, res) => {
	handleDeleteChannel(req, res);
});

async function handleDeleteChannel(req, res) {
	let foundChannel = await Channel.findOne({ownerID: req.user.id});
	let platforms = [];

	if(foundChannel) {
		Object.keys(foundChannel.platforms).forEach(platform => {
			if(foundChannel.platforms[platform]) {
				platforms.push(platform);
			}
		})
		//delete all earned
		let earnedErr = await Earned.deleteMany({channelID: foundChannel.id});
		//delete all listeners
		let listenerErr = await Listener.deleteMany({channel: foundChannel.ownerID});
		//delete all achievements
		let achErr = await Achievement.deleteMany({channel: foundChannel.ownerID});
		//delete all uploaded images
		let imgErr = await Image.deleteMany({channel: foundChannel.ownerID});
		//delete the channel
		let channelErr = await Channel.deleteOne({ownerID: req.user.id});
		//update user to be 'user'
		req.user.type = "user";
		req.user.delegate = [];

		let savedUser = await req.user.save();

		emitDeleteChannel(req, req.user, platforms);

		res.json({
			delete: true
		});
		//TODO: update channel retrieve to remove channel from user when it doesn't exist
	} else {
		res.json({
			delete: false,
			err: "Channel not found"
		});
	}
}

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

//Popup for new memebers
router.post('/setup/join', isAuthorized, (req, res) => {
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
						sync: true,
						banned: false
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
					sync: true,
					banned: false
				};
				req.user.channels.push(newChannelObj);
				req.user.save().then((savedUser) => {

					existingChannel.members.push(savedUser.id);
					existingChannel.save().then((savedChannel) => {


						Earned.countDocuments({userID: req.user.id, channelID: savedChannel.id}).then(achCount => {
							let percentage = 0;

							Achievement.countDocuments({channel: savedChannel.owner}).then(count => {

								if(count > 0) {
									percentage = Math.round((achCount / count) * 100);
								}

								res.json({
									owner: savedChannel.owner,
									logo: savedChannel.logo,
									percentage
								});
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
})

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
						sync: true,
						banned: false
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
					sync: true,
					banned: false
				};
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

router.get('/extension/list', isExtensionAuthorized, (req, res) => {
	Channel.find({}).then(channels => {
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
					let earned, retAchievements, banned;

					let achPromise;

					achPromise = new Promise((resolve, reject) => {
						let channelIDX = req.user.channels.findIndex((channel) => {
							return (channel.channelID === foundChannel.id)
						});

						banned = (channelIDX >= 0) ? req.user.channels[channelIDX].banned : false;

						let earnedQuery = {
							userID: req.user.id,
							channelID: foundChannel.id
						};

						if(req.user.new) {
							earnedQuery.userID = { $in: [req.user.id, req.user.integration.twitch.etid]};
						}

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
									favorited,
									banned
								});	
							} else {
								res.json({
									error: "Channel doesn't exist"
								});
							}
						});
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

router.post('/update', async (req, res) => {
	let channels = req.body;
	let updatedChannels = [];

	await asyncForEach(channels, async (channel) => {
		let updatedChannel = false;
		let foundUser = await User.findOne({name: channel});
		
		if(foundUser) {
			let instance = await getTwitchAxiosInstance();

			let response = await instance.get(`https://api.twitch.tv/helix/users/?id=${foundUser.integration.twitch.etid}`);

			foundUser.name = response.data.data[0].login;
			foundUser.logo = response.data.data[0].profile_image_url;

			let savedUser = await foundUser.save();

			let foundChannel = await Channel.findOne({twitchID: savedUser.integration.twitch.etid});
				
			if(foundChannel) {
				if(foundChannel.owner !== savedUser.name) {
					updatedChannel = true;
					foundChannel.owner = savedUser.name;
				}

				if(foundChannel.logo !== savedUser.logo) {
					updatedChannel = true;
					foundChannel.logo = savedUser.logo;
				}

				if(updatedChannel) {
					let savedChannel = await foundChannel.save();
				}

				let foundAchievements = await Achievement.find({channel: channel});

				if(foundAchievements.length > 0) {
					asyncForEach(foundAchievements, ach => {
						ach.channel = savedUser.name;
						ach.save();
					});
				}

				let foundListeners = await Listener.find({channel: channel});
					
				if(foundListeners.length > 0) {
					asyncForEach(foundListeners, list => {
						list.channel = savedUser.name;
						list.save();
					});
				}

				updatedChannels.push({
					old: channel,
					new: savedUser.name
				});
			}
		}
	});

	res.json({
		updatedChannels
	})
})

router.get('/dashboard', isAuthorized, async (req, res) => {

	let existingChannel = await Channel.findOne({ownerID: req.user.id});

	if(existingChannel) {

		let achievementsPromise = new Promise((resolve, reject) => {
			Achievement.find({ownerID: existingChannel.ownerID}).then((achievements) => { 

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
									uid: achievement.uid,
									title: achievement.title,
									description: achievement.description,
									shortDescription: achievement.shortDescription,
									icon: achievement.icon,
									earnable: achievement.earnable,
									limited: achievement.limited,
									secret: achievement.secret,
									order: achievement.order,
									unlocked: listenerData.unlocked || false,
									achType: listenerData.achType,
									platforms: listenerData.platforms
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
			Image.find({channel: existingChannel.ownerID}).then(foundImages => {
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
		});

		let eventsPromise = new Promise((resolve, reject) => {
			Event.find({channelID: existingChannel.id}).sort({'_id': -1}).limit(30).exec((err, events) => {
				let resEvents = events.map(ev => {
					return {
						member: ev.member,
						platform: ev.platform,
						achievement: ev.achievement,
						date: ev.date
					}
				});

				resolve(resEvents);
			});
		})

		Promise.all([achievementsPromise, imagesPromise, moderatorsPromise, eventsPromise]).then(values => {
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
						moderators: values[2],
						events: values[3]
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
						moderators: values[2],
						events: values[3]
					});
				})
			} else if(!existingChannel.referral || !existingChannel.referral.code) {
				let code = "";

				code += req.user.name.toUpperCase();

				while (code.length < 6) {
					code += "1";
				}

				Channel.find({'referral.code': {"$regex" : code, "$options": "i"}}).then(foundChannels => {
					if(foundChannels.length > 0) {
						code += foundChannels.length + 1;	
					}

					existingChannel.referral = {
						referred: 0,
						code
					}
					existingChannel.save().then(savedChannel => {
						retChannel = {...savedChannel['_doc']};
						delete retChannel['__v'];
						delete retChannel['_id'];

						res.json({
							channel: retChannel,
							achievements: values[0],
							images: values[1],
							moderators: values[2],
							events: values[3]
						});
					})
				})
				
				
			} else {
				retChannel = {...existingChannel['_doc']};
				delete retChannel['__v'];
				delete retChannel['_id'];

				res.json({
					channel: retChannel,
					achievements: values[0],
					images: values[1],
					moderators: values[2],
					events: values[3]
				});
			}
		});
		
	} else {
		res.json({
			error: 'User doesn\'t manage a channel'
		});
	}	
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

router.post('/mod/preferences', isModAuthorized, (req, res) => {
	updateChannelPreferences(req, res, req.channel);
});

router.post('/preferences', isAuthorized, (req, res) => {
	Channel.findOne({ownerID: req.user.id}).then(existingChannel => {
		if(existingChannel) {
			updateChannelPreferences(req, res, existingChannel);
		} else {
			res.json({
				error: 'Issue updating preferences'
			});
		}
	});
});

let updateChannelPreferences = async (req, res, existingChannel) => {

	let defaultIcon, hiddenIcon, overlay;
	let img;

	if(req.body.defaultIcon && validDataUrl(req.body.defaultIcon)) {
			//got an image to upload
		img =  await uploadImage(req.body.defaultIcon, req.body.defaultIconName, req.body.defaultIconType, existingChannel.owner, 'default');
		if(!img.error) {
			defaultIcon = img.url;
		} else {
			res.json({
				error: img.error
			})
		}
		
	} else if(req.body.defaultImage && imgURLRegex.test(req.body.defaultImage)) {
		defaultIcon = req.body.defaultImage;
	}

	
	if(req.body.hiddenIcon && validDataUrl(req.body.hiddenIcon)) {
		//got an image to upload
		img = await uploadImage(req.body.hiddenIcon, req.body.hiddenIconName, req.body.hiddenIconType, existingChannel.owner, 'hidden');
		if(!img.error) {
			hiddenIcon = img.url;
		} else {
			res.json({
				error: img.error
			})
		}
	} else if(req.body.hiddenImage && imgURLRegex.test(req.body.hiddenImage)) {
		hiddenIcon = req.body.hiddenImage;
	}

	
	if(req.body.overlay) {
		let {
			chat,
			chatMessage,
			sfx,
			enterEffect,
			exitEffect,
			duration,
			volume,
			delay,
			custom,
			graphic,
			graphicName,
			graphicType,
			layout,
			textColor,
			titleFontSize,
			showDescription,
			descFontSize
		} = req.body.overlay;

		overlay = existingChannel.overlay || {};

		if(chat !== undefined) {
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

		if(existingChannel.gold) {
			if(custom !== undefined) {
				overlay.custom = custom;
			}

			if(graphic && validDataUrl(graphic)) {
				//got an image to upload
				let uploadedGraphic = await uploadImage(graphic, graphicName, graphicType, existingChannel.owner, 'graphic');

				if(!uploadedGraphic.error) {
					overlay.graphic = uploadedGraphic.url;
				} else {
					res.json({
						error: img.error
					})
				}
			} else if(graphic && imgURLRegex.test(graphic)) {
				overlay.graphic = graphic;
			} else {
				overlay.graphic = undefined
			}

			if(layout) {
				overlay.layout = layout;
			}

			if(textColor) {
				overlay.textColor = textColor;
			}

			if(titleFontSize) {
				overlay.titleFontSize = titleFontSize;
			}

			if(showDescription !== undefined) {
				overlay.showDescription = showDescription;
			}

			if(descFontSize) {
				overlay.descFontSize = descFontSize;
			}
		}
	}

	let iconsUpdate = {
		default: existingChannel.icons.default,
		hidden: existingChannel.icons.hidden
	};

	if(defaultIcon) {
		iconsUpdate.default = defaultIcon;
	}

	if(hiddenIcon) {
		iconsUpdate.hidden = hiddenIcon;
	}

	if(overlay) {
		existingChannel.overlay = overlay;
		updateSettings = true;
	}

	existingChannel.icons = iconsUpdate;

	let savedChannel = await existingChannel.save();

	if(updateSettings) {
		emitOverlaySettingsUpdate(req, {
			channel: savedChannel.owner,
			overlay: savedChannel.overlay
		});
	}

	let foundImages = await Image.find({channel: existingChannel.owner});

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
				Channel.findOne({ownerID: req.user.id}).then(existingChannel => {
					
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
				
				return new Promise((resolve2, reject) => {
					Earned.countDocuments({userID: req.user.id, channelID: channel.id}).then(achCount => {
						let percentage = 0;

						Achievement.countDocuments({ownerID: channel.ownerID}).then(count => {

							if(count > 0) {
								percentage = Math.round((achCount / count) * 100);
							}

							resolve2({
					     		logo: channel.logo,
					     		owner: channel.platforms.twitch.alias,
					     		percentage: percentage,
					     		favorite: true
					     	});
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
				
				return new Promise((resolve2, reject) => {
					Earned.countDocuments({userID: req.user.id, channelID: channel.id}).then(achCount => {
						let percentage = 0;

						Achievement.countDocuments({ownerID: channel.ownerID}).then(count => {

							if(count > 0) {
								percentage = Math.round((achCount / count) * 100);
							}

							resolve2({
					     		logo: channel.logo,
					     		//owner: channel.owner,
					     		owner: "",
					     		percentage: percentage,
					     		favorite: false
					     	});
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

router.get('/member/select', isAuthorized, (req, res) => {
	User.findOne({name: req.query.uid}).then(foundUser => {
		if(foundUser) {
			Channel.findOne({owner: req.query.owner}).then(foundChannel => {
				if(foundChannel) {
					Earned.find({userID: foundUser.id, channelID: foundChannel.id}, ['achievementID']).then(foundEarned => {

						let channelIndex = foundUser.channels.findIndex(channel => (channel.channelID === foundChannel.id));
						let banned = foundUser.channels[channelIndex].banned;
						let achievements = foundEarned.map(found => found.achievementID);

						res.json({
							name: foundUser.name,
							logo: foundUser.logo,
							achievements,
							banned
						});
					})
				}
			});
			
		}
	})
})

router.post('/member/save', isAuthorized, (req, res) => {
	let currentDate = Date.now();

	User.findOne({name: req.body.id}).then(foundUser => {
		if(foundUser) {
			Channel.findOne({owner: req.user.name}).then(foundChannel => {
				if(foundChannel) {
					let channelIdx = foundUser.channels.findIndex(channel => channel.channelID === foundChannel.id);
					
					if(channelIdx >= 0 && !foundUser.channels[channelIdx].banned) {

						let achievements = req.body.achievements;
						
						Earned.find({achievementID: { $in: achievements}, userID: foundUser.id, channelID: foundChannel.id}).then(earneds => {
							let foundAchs = earneds.map(earned => earned.achievementID);

							let newAchs = req.body.achievements.map(ach => {
								if(foundAchs.indexOf(ach) < 0) {
									new Earned({
										userID: foundUser.id,
										channelID: foundChannel.id,
										achievementID: ach,
										earned: currentDate,
										first: false
									}).save();
								}
							});

							Earned.deleteMany({achievementID: { $in: foundAchs}, userID: foundUser.id, channelID: foundChannel.id}).then(err => {

								new Notice({
									user: foundUser._id,
									logo: foundChannel.logo,
									message: `Your achievements have been adjusted by the owner of the channel!`,
									date: Date.now(),
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
									
									Earned.find({userID: foundUser.id, channelID: foundChannel.id}, ['achievementID']).then(latestEarned => {

										let userAchievements = latestEarned.map(latest => latest.achievementID);

										res.json({
											member: {
												name: foundUser.name,
												logo: foundUser.logo,
												achievements: userAchievements,
												banned: foundUser.channels[channelIdx].banned
											}
										});
									})
								});
							})
						});
					}
				}
			})
		}
	})
})

router.post("/member/reset", isAuthorized, (req, res) => {
	User.findOne({name: req.body.id}).then(foundUser => {
		if(foundUser) {
			Channel.findOne({owner: req.user.name}).then(foundChannel => {
				if(foundChannel) {
					//TODO: Delete all entries in Earned for this member

					Earned.deleteMany({userID: foundUser.id, channelID: foundChannel.id}).then(err => {

						new Notice({
							user: foundUser._id,
							logo: foundChannel.logo,
							message: `Your achievements have been adjusted by the owner of the channel!`,
							date: Date.now(),
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

						res.json({
							member: {
								name: foundUser.name,
								logo: foundUser.logo,
								achievements: []
							}
						});
					});
				}
			})
		} else {
			res.json({
				error: 'Unexpected error occured'
			});
		}
	})
});

router.post("/member/ban", isAuthorized, (req, res) => {
	User.findOne({name: req.body.id}).then(foundUser => {
		if(foundUser) {
			Channel.findOne({owner: req.user.name}).then(foundChannel => {
				if(foundChannel) {
					let channelIdx = foundUser.channels.findIndex(channel => channel.channelID === foundChannel.id);

					if(channelIdx >= 0) {
						foundUser.channels[channelIdx].banned = true;

						if(req.body.resetAchievements) {
							Earned.deleteMany({userID: foundUser.id, channelID: foundChannel.id}).then(err => {

							});
						}
						
						foundUser.save().then(savedUser => {
							
							Earned.find({userID: foundUser.id, channelID: foundChannel.id}, ['achievementID']).then(latestEarned => {

								let userAchievements = latestEarned.map(latest => latest.achievementID);

								res.json({
									member: {
										name: savedUser.name,
										logo: savedUser.logo,
										achievements: userAchievements,
										banned: true
									}
								});
							});
						})
					}
				}
			})
		} else {
			res.json({
				error: 'Unexpected error occured'
			});
		}
	})
});

router.post("/member/unban", isAuthorized, (req, res) => {
	User.findOne({name: req.body.id}).then(foundUser => {
		if(foundUser) {
			Channel.findOne({owner: req.user.name}).then(foundChannel => {
				if(foundChannel) {
					let channelIdx = foundUser.channels.findIndex(channel => channel.channelID === foundChannel.id);

					if(channelIdx >= 0) {
						foundUser.channels[channelIdx].banned = false;
						
						foundUser.save().then(savedUser => {
							
							Earned.find({userID: foundUser.id, channelID: foundChannel.id}, ['achievementID']).then(latestEarned => {

								let userAchievements = latestEarned.map(latest => latest.achievementID);

								res.json({
									member: {
										name: savedUser.name,
										logo: savedUser.logo,
										achievements: userAchievements,
										banned: false
									}
								});
							});
						})
					}
				}
			})
		} else {
			res.json({
				error: 'Unexpected error occured'
			});
		}
	})
});

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

router.post("/signup", isAuthorized, (req, res) => {
	//generate code
	let referral = req.body.referral;

	let token = new Token({
		uid: req.user._id,
		token: 'not issued',
		referral,
		notified: false
	});

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
				emitNotificationsUpdate(req, {
					notification: {
						id: savedNotice._id,
						logo: savedNotice.logo,
						message: savedNotice.message,
						date: savedNotice.date,
						type: savedNotice.type,
						status: savedNotice.status
					},
					user: req.user.name
				});
			});

		    res.json({
		    	message: "email sent"
		    });
		});

	});
});

router.post('/verify', isAuthorized, async (req, res) => {
	let token = req.body.id;

	let foundToken = await Token.findOne({uid: req.user._id, token});

	if(foundToken) {
		if(foundToken.hasExpired()) {
			let tokenDeleteError = await Token.deleteOne({uid: req.user._id, token});

			res.json({
				expired: true
			});
		} else {
			let fullAccess = false;
			let referral = foundToken.referral;

			let type = req.user.broadcaster_type;
			let patreon = req.user.integration.patreon;

			if(patreon && (patreon.type === 'forever' || patreon.is_gold)) {
				fullAccess = true;
			}

			if(referral) {
				let foundChannel = await Channel.findOne({'referral.code': referral})
					
				foundChannel.referral.referred += 1;

				let savedChannel = await foundChannel.save();

				if(savedChannel.referral.referred === 1) {

					let foundUser = await User.findOne({'_id': savedChannel.ownerID})
					new Notice({
						user: foundUser.id,
						logo: DEFAULT_ICON,
						message: `Someone just created their channel using your referral code! You now have one extra custom achievement you can create! Go try it out!`,
						date: Date.now(),
						type: 'dashboard',
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
								status: savedNotice.status
							},
							user: foundUser.name
						});
					});
				}

			}

			let newChannel = await new Channel({
				ownerID: req.user.id,
				platforms: req.user.integration,
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
				gold: fullAccess,
				broadcaster_type: req.user.broadcaster_type || {}
			}).save();

			//TODO: Send email detailing info from confirmation page

			console.log('--------------------');
			console.log(`${newChannel.platforms[req.cookies._ap].name} just created their channel!`);
			console.log('--------------------');

			new Notice({
				user: process.env.NOTICE_USER,
				logo: newChannel.logo,
				message: `${newChannel.platforms[req.cookies._ap].name} just created their channel!`,
				date: Date.now(),
				type: 'achievement',
				channel: newChannel.owner,
				status: 'new'
			}).save();

			emitNewChannel(req, {
				name: newChannel.platforms[req.cookies._ap].name,
				'full-access': fullAccess,
				online: false
			});

			req.user.type = 'verified';
			let savedUser = await req.user.save();
				
			Token.deleteOne({uid: req.user._id, token}).then(err => {
				console.log(err);
			});

			res.json({
				verified: true
			});	
		}
	} else {
		res.json({
			error: 'Unauthorized'
		});
	}
});

router.post('/token/generate', isAuthorized, (req, res) => {
	
	Token.findOne({uid: req.user._id}).then(foundToken => {
		if(foundToken) {
			let generatedToken = crypto.randomBytes(16).toString('hex');

			foundToken.token = generatedToken;
			foundToken.created = Date.now();
			foundToken.notified = false;
			foundToken.save().then(savedToken => {

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
				   	if(err) {
				     	console.log(err);

						res.json({
							token: false
						});
				   	} else {

					   	new Notice({
							user: req.user._id,
							logo: DEFAULT_ICON,
							message: "A new confirmation code has been sent to your email, and don't forget to check your spam folder!",
							date: Date.now(),
							type: 'confirmation',
							status: 'new'
						}).save().then(savedNotice => {
							emitNotificationsUpdate(req, {
								notification: {
									id: savedNotice._id,
									logo: savedNotice.logo,
									message: savedNotice.message,
									date: savedNotice.date,
									type: savedNotice.type,
									status: savedNotice.status
								},
								user: req.user.name
							});
						});

					    res.json({
					    	token: true
					    });
					}
				});

			});
		} else {
			res.json({
				token: false
			});
		}
	})
})

router.get('/overlay', (req, res) => {
	let oid = req.query.id;

	Channel.findOne({oid: oid}).then(foundChannel => {
		if(foundChannel) {

			let keyLength = Object.keys(foundChannel.overlay);
			let defaultKeys = Object.keys(DEFAULT_OVERLAY_CONFIG);

			//One less due to mongodb $init prop
			if((keyLength.length - 1) !== defaultKeys.length) {
				let overlay = foundChannel.overlay;
				//Fill in the blanks
				defaultKeys.forEach(config => {
					if(overlay[config] === undefined) {
						overlay[config] = DEFAULT_OVERLAY_CONFIG[config];
					}
				});

				foundChannel.overlay = overlay;
				foundChannel.save().then(savedChannel => {
					res.json({
						overlay: savedChannel.overlay,
						icons: savedChannel.icons
					});
				});
			} else {
				res.json({
					overlay: foundChannel.overlay,
					icons: foundChannel.icons
				});	
			}
		}
	});
})

router.get('/testOverlay', isAuthorized, (req, res) => {
	Channel.findOne({owner: req.user.name}).then(foundChannel => {
		if(foundChannel) {

			emitOverlayAlert(req, {
				user: 'testUser',
				channel: foundChannel.owner,
				title: 'Test Achievement',
				icon: 'https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png',
				unlocked: true
			});

			let overlaySettings = foundChannel.overlay;
			let chatMessage;

			if(overlaySettings.chatMessage && overlaySettings.chatMessage !== '') {
				chatMessage = build({
					chatMessage: overlaySettings.chatMessage,
					member: 'testUser',
					achievement: 'Test Achievement'
				});
			} else {
				chatMessage = `${achievementData.member} just earned the "${achievementData.achievement}" achievement! PogChamp`;
			}

			emitAwardedAchievement(req, {
				channel: foundChannel.owner,
				message: chatMessage
			});

		}
	})

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

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

module.exports = router;