const router = require('express').Router();
const passport = require('passport');
const {isAuthorized, isAdminAuthorized} = require('../utils/auth-utils');
const mongoose = require('mongoose');
const keys = require('../configs/keys');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(keys.session.cookieKey);
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validDataUrl = require('valid-data-url');

const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Image = require('../models/image-model');
const Token = require('../models/token-model');
const {uploadImage, destroyImage} = require('../utils/image-utils');

const imgURLRegex = /^https:\/\/res\.cloudinary\.com\/phirehero\/.*\.(png|jpg|jpeg)$/gm;

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
				members: []
			}).save().then((newChannel) => {
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
						achievements: []
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
				req.user.channels.push({
					channelID: existingChannel.id,
					achievements: []
				});
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

router.get('/retrieve', isAuthorized, (req, res) => {
	let channel = req.query.id;
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
		Channel.findOne({owner: channel}).then((foundChannel) => {
				if(foundChannel) {
					
					Achievement.find({channel: channel}).then((foundAchievements) => {

						let joined = foundChannel.members.includes(req.user.id);
						let earned, retAchievements;

						if(joined) {
							earnedAchievements = req.user.channels.filter((channel) => {
								return (channel.channelID === foundChannel.id)
							})[0];

							earned = earnedAchievements.achievements.map(achievement => achievement.aid);

							retAchievements = foundAchievements.map(achievement => {
								let ach = Object.assign({}, achievement._doc);

								let aIdx = earned.findIndex(aid => aid === ach.uid);

								if(aIdx >= 0) {
									ach.earned = earnedAchievements.achievements[aIdx].earned;
								}

								return ach
							})
						} else {
							earned = [];
						}

						res.json({
							channel: foundChannel,
							achievements: retAchievements,
							joined: joined
						});
					});	
					
				} else {
					res.json({
						error: "No channel found for the name: " + channel
					});
				}
			});
	} else {
		//use current logged in person's channel
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
											code: listenerData.code
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
							//filter out default img
							//filter out hidden img
							// let defaultImg, hiddenImg;

							// let returnImgs = foundImages.filter((img) => {
							// 	if(img.type === 'default') {
							// 		defaultImg = img;
							// 		return false;
							// 	} else if(img.type === 'hidden') {
							// 		hiddenImg = img;
							// 		return false;
							// 	}

							// 	return true;
							// });

							// resolve({
							// 	gallery: returnImgs,
							// 	default: defaultImg,
							// 	hidden: hiddenImg
							// });

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

				let membersPromise = new Promise((resolve, reject) => {
					User.find({'_id': { $in: existingChannel.members}}).then((members) => {
						//Filter out member data: name, logo, achievements

						let resMembers = members.map(member => {
							return {
								name: member.name,
								logo: member.logo,
								achievements: member.channels.filter((channel) => (channel.channelID === existingChannel.id))[0].achievements
							}
						});

						resolve(resMembers);
					});
				});

				Promise.all([achievementsPromise, imagesPromise, membersPromise]).then(values => {
					res.json({
						channel: existingChannel,
						achievements: values[0],
						images: values[1],
						members: values[2]
					})
				});
				
			} else {
				res.json({
					error: 'User doesn\'t manage a channel'
				});
			}	
		});
	}
});

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

router.post('/preferences', isAuthorized, (req, res) => {
	Channel.findOne({twitchID: req.user.integration.twitch.etid}).then(existingChannel => {
		
		let defaultPromise, hiddenPromise;
		//upload images if needed
		
		defaultPromise = new Promise((resolve, reject) => {
			if(req.body.defaultIcon && validDataUrl(req.body.defaultIcon)) {
				//got an image to upload
				uploadImage(req.body.defaultIcon, req.body.defaultIconName, existingChannel.owner, 'default').then(iconImg => {
					existingChannel.icons = existingChannel.icons || {};
					existingChannel.icons.default = iconImg.url
					resolve();
				});
			} else if(req.body.defaultImage && imgURLRegex.test(req.body.defaultImage)) {
				//check if URL before setting it
				existingChannel.icons = existingChannel.icons || {};
				existingChannel.icons.default = req.body.defaultImage;
				resolve();
			} else {
				resolve();
			}
		});

		hiddenPromise = new Promise((resolve, reject) => {
			if(req.body.hiddenIcon && validDataUrl(req.body.hiddenIcon)) {
				//got an image to upload
				uploadImage(req.body.hiddenIcon, req.body.hiddenIconName, existingChannel.owner, 'hidden').then(iconImg => {
					existingChannel.icons = existingChannel.icons || {};
					existingChannel.icons.hidden = iconImg.url
					resolve();
				});
			} else if(req.body.hiddenImage && imgURLRegex.test(req.body.hiddenImage)) {
				//check if URL before setting it
				existingChannel.icons = existingChannel.icons || {};
				existingChannel.icons.hidden = req.body.hiddenImage;
				resolve();
			} else {
				resolve();
			}
		});

		Promise.all([defaultPromise, hiddenPromise]).then(() => {
			existingChannel.save().then(savedChannel => {
				console.log(savedChannel.icons);

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
		})
	});
});

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
					delete icons[image.type];
					existingChannel.icons = icons;
					console.log('hya');

					existingChannel.save().then(savedChannel => {
						resolve(savedChannel);
					});
				});
			});
			
		} else {
			channelUpdatePromise = Promise.resolve();
		}

		Promise.all([achievementPromise, imagePromise, channelUpdatePromise]).then(values => {
			console.log(values);
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

	let channelArray = req.user.channels.map(channel => new mongoose.Types.ObjectId(channel.channelID));

	Channel.find({'_id': { $in: channelArray}}).then((channels) => {

		let channelResponse = [];

		let promises = channels.map(channel => {
			let earnedAchievements = req.user.channels.filter(userChannel => (userChannel.channelID === channel.id));
			let percentage = 0;

			return new Promise((resolve, reject) => {
				Achievement.countDocuments({channel: channel.owner}).then(count => {
					console.log(count);
					if(count > 0) {
						percentage = Math.round((earnedAchievements[0].achievements.length / count) * 100);
					}

					resolve({
			     		logo: channel.logo,
			     		owner: channel.owner,
			     		percentage: percentage
			     	});
			    });
			});
		});

		Promise.all(promises).then(responseData => {
			res.json(responseData);
		});
	});
});

router.post("/signup", isAuthorized, (req, res) => {
	//generate code
	let uid = req.body.uid;

	Token.findOne({uid}).then(foundToken => {
		if(foundToken) {
			res.json({
				error: "You have already signed up!"
			});
		} else {
			let token = new Token({uid: req.user._id, token: 'not issued'});

			token.save().then(savedToken => {
				res.json({
					signup: true
				});
			});
		}
	});
});

router.post('/queue', isAdminAuthorized, (req, res) => {
	let uid = req.body.uid;

	Token.deleteOne({uid}).then(err => {
		User.find({'_id': uid}).then(foundUser => {
			let email = foundUser.email;
			var transporter = nodemailer.createTransport({
				service: 'gmail',
				auth: {
					user: keys.gmail.user,
					pass: keys.gmail.password
				}
			});

			const mailOptions = {
			    from: 'Stream Achievements <' + keys.gmail.user + '>', // sender address
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

		console.log(uid);

		Token.findOne({uid}).then(foundToken => {
			let generatedToken = crypto.randomBytes(16).toString('hex');
			foundToken.token = generatedToken;
			foundToken.created = Date.now();
			foundToken.save().then(savedToken => {
				//email token to user
				User.find({'_id': savedToken.uid}).then(foundUser => {
					let email = foundUser.email;


					var auth = {
					    type: 'oauth2',
					    user: keys.gmail.user,
					    clientId: keys.gmail.clientID,
					    clientSecret: keys.gmail.clientSecret,
					    refreshToken: keys.gmail.refreshToken
					};

					var transporter = nodemailer.createTransport({
						service: 'gmail',
						auth: auth
					});

					const mailOptions = {
					    from: keys.gmail.user, // sender address
					    to: 'phireherottv@gmail.com', // list of receivers
					    subject: 'Your Confirmation Code!', // Subject line
					    html: '<div style="background:#222938;padding-bottom:30px;"><h1 style="text-align:center;background:#2f4882;padding:15px;margin-top:0;"><img style="max-width:600px;" src="https://res.cloudinary.com/phirehero/image/upload/v1557947921/sa-logo.png" /></h1><h2 style="color:#FFFFFF; text-align: center;margin-top:30px;margin-bottom:25px;font-size:22px;">Thank you for your interest in Stream Achievements!</h2><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We reviewed your channel and feel you are a perfect fit to join in on this pilot, and test the new features we aim to provide for streamers!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">To get started, all you need to do is <a style="color: #ecdc19;" href="http://localhost:3000/channel/verify?id=' + generatedToken + '&utm_medium=Email">verify your account</a>, and you\'ll be all set!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We are truly excited to see what you bring in terms of Achievements, and can\'t wait to see how much your community engages!</p></div>'
					};

					transporter.sendMail(mailOptions, function (err, info) {
					   if(err)
					     console.log(err)
					   else
					     res.json({
					     	message: "email sent"
					     });
					});
				});
			});
		});
	});
});

router.post('/verify', isAuthorized, (req, res) => {
	let token = req.body.id;
	console.log(req.user._id);
	console.log(token);
	Token.findOne({uid: req.user._id, token}).then(foundToken => {
		if(foundToken) {
			console.log(foundToken);
			if(foundToken.hasExpired()) {
				// Token.deleteOne({uid: req.user._id, token}).then(err => {
				// 	res.json({
				// 		expired: true
				// 	});	
				// });
				
				res.json({
					expired: true
				});
			} else {
				// Token.deleteOne({uid: req.user._id, token}).then(err => {
				// 	res.json({
				// 		verified: true
				// 	});
				// });
				new Channel({
					owner: req.user.name,
					twitchID: req.user.integration.twitch.etid,
					theme: '',
					logo: req.user.logo,
					achievements: [],
					members: []
				}).save().then((newChannel) => {
					req.user.channelID = newChannel.id;
					req.user.save().then((savedUser) => {
						res.json({
							verified: true
						});
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

module.exports = router;