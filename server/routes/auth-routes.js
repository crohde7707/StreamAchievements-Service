const router = require('express').Router();
const Cryptr = require('cryptr');
const axios = require('axios');
const cryptr = new Cryptr(process.env.SCK);
const {
	isAuthorized,
	getTwitchAxiosInstance
} = require('../utils/auth-utils');
const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
const Notice = require('../models/notice-model');
const {
	emitBecomeGold,
	emitRemoveGold,
	emitConnectBot,
	emitDisconnectBot,
	emitChannelUpdate
} = require('../utils/socket-utils');

//patreon
let url = require('url');
let patreon = require('patreon');
let patreonAPI = patreon.patreon;
let patreonOAuth = patreon.oauth;

let patreonOauthClient = patreonOAuth(process.env.PCID, process.env.PCS);

const PATREON_IDENTITY_API = 'https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields%5Buser%5D=thumb_url,vanity';
const SILVER_TIER_ID = '3497636';
const GOLD_TIER_ID = '3497710';

const DEFAULT_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png";
const HIDDEN_ICON = "https://res.cloudinary.com/phirehero/image/upload/v1558811887/hidden-icon.png";

router.get('/twitch', async (req, res) => {
	res.redirect(`https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${process.env.TCID}&redirect_uri=${process.env.TPR}&scope=user_read%20user:read:email`);
});

router.get('/twitch/redirect', async (req, res) => {
		
	if(req.query.code) {
		let tokenRes = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TCID}&client_secret=${process.env.TCS}&code=${req.query.code}&grant_type=authorization_code&redirect_uri=${process.env.TPR}`);

		let {access_token, refresh_token} = tokenRes.data;

		let user;

		if(access_token && refresh_token) {
			//call out to get profile
			
			let userRes = await axios.get('https://api.twitch.tv/helix/users', {
				headers: {
					'client-id': `${process.env.TCID}`,
					Authorization: `Bearer ${access_token}`
				}
			});

			let profile = userRes.data.data[0];

			let e_token = cryptr.encrypt(access_token);
			let e_refresh = cryptr.encrypt(refresh_token);
			let twitchIntegration = {
				etid: profile.id.toString(),
				token: e_token,
				refresh: e_refresh
			};
				
			let existingUser = await User.findOne({'integration.twitch.etid': twitchIntegration.etid});

			let updated = false;

			if(existingUser) {
				existingUser.integration.twitch = twitchIntegration;

				if(existingUser.name !== profile.login) {
					existingUser.name = profile.login;
					updated = true;
				}

				if(existingUser.logo !== profile.profile_image_url) {
					existingUser.logo = profile.profile_image_url;
					updated = true;
				}

				if(existingUser.email !== profile.email) {
					existingUser.email = profile.email;
					updated = true;
				}

				if(existingUser.broadcaster_type !== profile.broadcaster_type) {
					existingUser.broadcaster_type = profile.broadcaster_type;
					updated = true;
				}

				user = await existingUser.save();

				let foundChannel = await Channel.findOne({twitchID: user.integration.twitch.etid});

				if(foundChannel) {
					let ownerUpdate = false;

					if(foundChannel.owner !== user.name) {
						updated = true;
						ownerUpdate = foundChannel.owner;
						foundChannel.owner = user.name;
					}

					if(foundChannel.logo !== user.logo) {
						updated = true;
						foundChannel.logo = user.logo;
					}

					let savedChannel = await foundChannel.save();
										
					if(updated) {
						new Notice({
							user: user._id,
							logo: "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png",
							message: "We noticed some information has been updated on Twitch, so we went ahead and updated your profile with those changes!",
							date: Date.now(),
							type: 'profile',
							status: 'new'
						}).save();

						if(ownerUpdate) {

							Achievement.find({channel: ownerUpdate}).then(foundAchievements => {
								if(foundAchievements.length > 0) {
									foundAchievements.forEach(ach => {
										ach.channel = savedChannel.owner;
										ach.save();
									});
								}
							});

							Listener.find({channel: ownerUpdate}).then(foundListeners => {
								if(foundListeners.length > 0) {
									foundListeners.forEach(list => {
										list.channel = savedChannel.owner;
										list.save();
									});
								}
							});
							//Name change occured, inform the IRC to connect
							user.update = {
								old: ownerUpdate,
								new: savedChannel.owner
							}	
						}
					}
				} else {
					if(updated) {
						new Notice({
							user: user._id,
							logo: "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png",
							message: "We noticed some information has been updated on Twitch, so we went ahead and updated your profile with those changes!",
							date: Date.now(),
							type: 'profile',
							status: 'new'
						}).save();
					}
				}
			} else {
				user = await new User({
					name: profile.login,
					logo: profile.profile_image_url,
					email: profile.email,
					type: 'user',
					channels: [],
					integration: {
						twitch: twitchIntegration
					},
					preferences: {
						autojoin: true
					},
					new: true
				}).save()
			}
		}

		//Set Cookie
		let etid = cryptr.encrypt(user.integration.twitch.etid);
		
		if(process.env.NODE_ENV === 'production') {
			res.cookie('etid', etid, { maxAge: 4 * 60 * 60 * 1000, httpOnly: false, secure: true, domain: 'streamachievements.com' });
		} else {
			res.cookie('etid', etid, { maxAge: 4 * 60 * 60 * 1000, httpOnly: false });
		}

		//let broadcasterTypePromise = new Promise((resolve, reject) => {
		if(user.type !== 'user') {
			let foundChannel = await Channel.findOne({owner: user.name});
					
			if(foundChannel) {
				if(user.update && user.update.old && user.update.new) {
					let update = {
						old: user.update.old,
						new: user.update.new,
						fullAccess: foundChannel.gold || false
					};

					emitChannelUpdate(req, update);
				}

				if(foundChannel.broadcaster_type) {
					if(foundChannel.broadcaster_type.twitch !== user.broadcaster_type) {
						foundChannel.broadcaster_type.twitch = user.broadcaster_type;
						let savedChannel = await foundChannel.save();
					}
				} else {
					foundChannel.broadcaster_type = {
						twitch: user.broadcaster_type
					};

					let savedChannel = await foundChannel.save();
				}
			}
		}

		//Check if user is a patron, and call out if so
		let patreonInfo = user.integration.patreon;
		let patreonPromise;

		if(patreonInfo && patreonInfo.status !== 'lifetime') {
			let {at, rt, id, expires} = patreonInfo;

			let refreshPromise;

			if(isExpired(expires)) {
				let newTokens = await refreshPatreonToken(req, patreonInfo.rt);
					
				if(newTokens) {
					at = newTokens.at;
					rt = newTokens.rt;
					expires = newTokens.expires;
				}
			}

			let patreon_access_token = cryptr.decrypt(at);
			
			if(!id) {
				id = user.integration.patreon.id;

				if(!id) {
					user.lastLogin = Date.now();
					
					let savedUser = await user.save();
					
					handleRedirect(req, res);
				}
			} else {
				try {

					let patreonResponse = await axios.get(`https://www.patreon.com/api/oauth2/v2/members/${id}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`, {
						headers: {
							Authorization: `Bearer ${patreon_access_token}`
						}
					});

					//active_patron, declined_patron, former_patron, null
					let patron_status = patreonResponse.data.data.attributes.patron_status;
					let is_follower = patreonResponse.data.data.attributes.is_follower;
					let tiers = patreonResponse.data.data.relationships.currently_entitled_tiers;
					let isGold = tiers.data.map(tier => tier.id).indexOf(GOLD_TIER_ID) >= 0;

					let patreonUpdate = {
						id: patreonInfo.id,
						thumb_url: patreonInfo.thumb_url,
						vanity: patreonInfo.vanity,
						at: at,
						rt: rt,
						is_follower,
						status: patron_status,
						is_gold: isGold,
						expires
					};

					if(user.integration.patreon) {
						if(!user.integration.patreon.is_gold && isGold) {
							//user became gold, enable on IRC side
							emitBecomeGold(req, user.name);
							new Notice({
								user: process.env.NOTICE_USER,
								logo: user.logo,
								message: `${user.name} just backed on Patreon!!`,
								date: Date.now(),
								type: 'achievement',
								channel: user.name,
								status: 'new'
							}).save();
						} else if(user.integration.patreon.is_gold && !isGold) {
							//user lost gold status, disable on IRC side
							new Notice({
								user: process.env.NOTICE_USER,
								logo: user.logo,
								message: `${user.name} stopped backing on Patreon`,
								date: Date.now(),
								type: 'achievement',
								channel: user.name,
								status: 'new'
							}).save();
							emitRemoveGold(req, user.name);
						} 	
					} else {
						if(isGold) {
							//user became gold, enable on IRC side
							new Notice({
								user: process.env.NOTICE_USER,
								logo: user.logo,
								message: `${user.name} just backed on Patreon!!`,
								date: Date.now(),
								type: 'achievement',
								channel: user.name,
								status: 'new'
							}).save();
							emitBecomeGold(req, user.name);
						} else {
							//user lost gold status, disable on IRC side
							new Notice({
								user: process.env.NOTICE_USER,
								logo: user.logo,
								message: `${user.name} stopped backing on Patreon`,
								date: Date.now(),
								type: 'achievement',
								channel: user.name,
								status: 'new'
							}).save();
							emitRemoveGold(req, user.name);
						} 
					}

					let integration = Object.assign({}, user.integration);

					integration.patreon = {...patreonUpdate};

					user.integration = integration;
					user.lastLogin = Date.now();
					
					let savedUser = await user.save();

					if(savedUser.type === 'verified' || savedUser.type === "admin") {
						let foundChannel = await Channel.findOne({owner: user.name});
						if(foundChannel.gold !== savedUser.integration.patreon.is_gold) {
							foundChannel.gold = savedUser.integration.patreon.is_gold;
							foundChannel.save();
						}
					}

					handleRedirect(req, res);

				} catch (error) {
					console.log(error.response);
					if(error.response.status === 401 || error.response.status === 403) {
						res.redirect('/auth/patreon');
					} else if(error.response.status === 404) {
						//Member used to follow, but now doesn't. Clear info

						let integration = Object.assign({}, user.integration);

						let patreonUpdate = {
							id: null,
							thumb_url: integration.patreon.thumb_url,
							vanity: integration.patreon.vanity,
							at: integration.patreon.at,
							rt: integration.patreon.rt,
							is_follower: null,
							status: null,
							is_gold: null,
							expires: integration.patreon.expires
						};

						integration.patreon = {...patreonUpdate};

						user.integration = integration;
						user.lastLogin = Date.now();
						let savedUser = await user.save()

						if(savedUser.type === 'verified' || savedUser.type === "admin") {
							let foundChannel = await Channel.findOne({owner: user.name});
							if(foundChannel.gold !== savedUser.integration.patreon.is_gold) {
								foundChannel.gold = false;
								foundChannel.save();
							}
						}

						handleRedirect(req, res);
					}
				}
			}
			
		} else {
			user.lastLogin = Date.now();

			let savedUser = user.save();
			handleRedirect(req, res);
		}
	}
})

router.get('/set', isAuthorized, (req, res) => {
	Channel.findOne({owner: req.user.name}).then(foundChannel => {
		if(foundChannel) {
			let integration = Object.assign({}, foundChannel.integration);

			integration.streamelements = {
				at: cryptr.encrypt('WjQ9yAvlRjSdwf_nrkHh-A'),
				rt: cryptr.encrypt('eafsskqETr6juMmHdIItAA'),
				expires: 2592000,
				type: 'oauth2'
			};

			foundChannel.integration = integration;

			foundChannel.save().then(savedChannel => {
				res.json({});
			});
		}
	})
})

router.get('/streamelements', isAuthorized, (req, res) => {
	let streamelementsURL = 'https://api.streamelements.com/oauth2/authorize?';
	streamelementsURL += 'client_id=' + process.env.SECID + '&';
	streamelementsURL += 'redirect_uri=' + process.env.SECPR + '&';
	streamelementsURL += 'response_type=code&scope=activities%3Aread';

	res.redirect(streamelementsURL);
});

router.get('/streamelements/redirect', isAuthorized, (req, res) => {
	console.log(req);
	let streamElementsTokenURL = 'https://api.streamelements.com/oauth2/token';

	axios.post(streamElementsTokenURL, {
		'grant_type': 'authorization_code',
		'client_id': process.env.SECID,
		'client_secret': process.env.SECCS,
		'code': req.query.code,
		'redirect_uri': process.env.SECPR
	}).then(response => {
		console.log(response);
		let at = cryptr.encrypt(response.data.access_token);

		Channel.find({owner: req.user.name}).then(foundChannel => {
			if(foundChannel) {
				let integrations = Object.assign({}, foundChannel.integrations);

				integrations.streamelements = {
					at
				};

				foundChannel.integrations = integrations;

				foundChannel.save().then(savedChannel => {
					// emitConnectBot(req, {
					// 	channel: req.user.name,
					// 	at,
					// 	bot: 'streamelements'
					// });

					res.redirect(process.env.WEB_DOMAIN + 'dashboard?tab=integration');
				});
			} else {
				res.redirect(process.env.WEB_DOMAIN + 'dashboard?tab=integration');
			}
		})
	})
})

router.get('/streamlabs', isAuthorized, (req, res) => {
	let streamlabsURL = 'https://www.streamlabs.com/api/v1.0/authorize?';
	streamlabsURL += 'client_id=' + process.env.SLCID + '&'; //NJWtH8OFUvAqxZcpHgsltzpJa81sQRTYQrVqDpYQ
	streamlabsURL += 'redirect_uri=' + process.env.SLCPR + '&';
	streamlabsURL += 'response_type=code&scope=socket.token';

	res.redirect(streamlabsURL);
});

router.get('/streamlabs/redirect', isAuthorized, (req, res) => {
	let streamlabsTokenURL = 'https://streamlabs.com/api/v1.0/token';

	axios.post(streamlabsTokenURL, {
		'grant_type': 'authorization_code',
		'client_id': process.env.SLCID,
		'client_secret': process.env.SLCCS,
		'code': req.query.code,
		'redirect_uri': process.env.SLCPR
	}).then(response => {

		axios.get('https://streamlabs.com/api/v1.0/socket/token?access_token=' + response.data.access_token).then(socket => {

			let st = cryptr.encrypt(socket.data.socket_token);

			let integration = Object.assign({}, req.user.integration);

			integration.streamlabs = {
			 	st
			};

			req.user.integration = integration;

			req.user.save().then(savedUser => {
				
				emitConnectBot(req, {
					channel: savedUser.name,
					st: savedUser.integration.streamlabs.st,
					bot: 'streamlabs'
				});
			 	
			 	res.redirect(process.env.WEB_DOMAIN + 'dashboard?tab=integration');
			});
		})
	});

})

router.get('/patreon', isAuthorized, (req, res) => {
	let patreonURL = 'https://www.patreon.com/oauth2/authorize?';
	patreonURL += 'response_type=code&';
	patreonURL += 'client_id=' + process.env.PCID + '&';
	patreonURL += 'redirect_uri=' + process.env.PPR;
	patreonURL += '&scope=campaigns%20identity%20identity%5Bemail%5D%20campaigns.members';

	res.redirect(patreonURL);
});

router.get('/patreon/redirect', isAuthorized, (req, res) => {
	let oauthGrantCode = req.query.code;

	return patreonOauthClient.getTokens(oauthGrantCode, process.env.PPR).then(tokenResponse => {
		let patreonAPIClient = patreonAPI(tokenResponse.access_token);
		let etid = (req.cookies.etid);

		return new Promise((resolve, reject) => {
							
			let at = cryptr.encrypt(tokenResponse.access_token);
			let rt = cryptr.encrypt(tokenResponse.refresh_token);

			//handle expires in
			let today = new Date();
			let expireDate = new Date().setDate(today.getDate() + 14);
			
			let vanity;
			let thumb_url;

			axios.get(PATREON_IDENTITY_API, {
				headers: {
					Authorization: `Bearer ${tokenResponse.access_token}`
				}
			}).then(res => {
				vanity = res.data.data.attributes.vanity;
				thumb_url = res.data.data.attributes.thumb_url;

				if(!res.data.included) {
					//patron is not a member of the patreon
					//set at, rt, and thumb_url in DB, display panel to follow

					resolve({
						thumb_url,
						vanity,
						at,
						rt,
						etid,
						expires: expireDate
					});
				} else {
					//patron is a member via follow, active_patron, declined_patron, or former_patron
					let longID = (res.data.included[0].id);

					axios.get(`https://www.patreon.com/api/oauth2/v2/members/${longID}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`, {
						headers: {
							Authorization: `Bearer ${tokenResponse.access_token}`
						}
					}).then(res => {
						
						//active_patron, declined_patron, former_patron, null
						let patron_status = res.data.data.attributes.patron_status;
						let is_follower = res.data.data.attributes.is_follower;
						let tiers = res.data.data.relationships.currently_entitled_tiers;
						let isGold = tiers.data.map(tier => tier.id).indexOf(GOLD_TIER_ID) >= 0;

						resolve({
							id: longID,
							thumb_url,
							vanity,
							at,
							rt,
							etid,
							is_follower,
							status: patron_status,
							is_gold: isGold,
							expires: expireDate
						});
					});
				}
			});
		});
	}).then(patreonData => {
		
		let {id, thumb_url, vanity, at, rt, etid, is_follower, status, is_gold, expires} = patreonData;

		let integration = Object.assign({}, req.user.integration);

		integration.patreon = {id, thumb_url, vanity, at, rt, is_follower, status, is_gold, expires};

		if(is_gold) {
			//user became gold, enable on IRC side
			emitBecomeGold(req, req.user.name);
		} else {
			//user lost gold status, disable on IRC side
			emitRemoveGold(req, req.user.name);
		} 

		req.user.integration = integration;

		req.user.save().then(savedUser => {
			
			if(savedUser.type === 'verified') {
				Channel.findOne({owner: req.user.name}).then(foundChannel => {
					if(foundChannel.gold !== is_gold) {
						foundChannel.gold = is_gold;
						foundChannel.save();
					}
				});
			}
			
			res.redirect(process.env.WEB_DOMAIN + 'profile?tab=integration');
		});

	});
});

router.post('/twitch/sync', isAuthorized, (req, res) => {
	twitchSync(req, req.user, req.cookies.etid).then(twitchData => {
		res.json(twitchData);
	});
})

router.post('/patreon/sync', isAuthorized, (req, res) => {
	
	patreonSync(req, req.cookies.etid).then((patreonData) => {
		res.json(patreonData);
	});
});

router.post('/streamlabs/unlink', isAuthorized, (req, res) => {
	let integration = Object.assign({}, req.user.integration);

	delete integration.streamlabs;

	req.user.integration = integration;

	req.user.save().then(savedUser => {

		emitDisconnectBot(req, {
			channel: savedUser.name,
			bot: 'streamlabs'
		});

		res.json({
			success: true,
			service: 'streamlabs'
		});
	});
})

router.post('/patreon/unlink', isAuthorized, (req, res) => {
	let integration = Object.assign({}, req.user.integration);

	delete integration.patreon;

	if(req.user.type === 'verified') {
		emitRemoveGold(req, req.user.name);
	}

	req.user.integration = integration;

	req.user.save().then(savedUser => {

		//Check if user owns a channel
		Channel.findOne({owner: req.user.name}).then(foundChannel => {
			if(foundChannel) {
				//user owns a channel, update their default and hidden icons
				foundChannel.icons = {
					default: DEFAULT_ICON,
					hidden: HIDDEN_ICON
				};

				foundChannel.save().then(savedChannel => {
					res.json({
						success: true,
						service: 'patreon'
					});
				})
			} else {
				res.json({
					success: true,
					service: 'patreon'
				});
			}
		})

		
	});	
});

let handleRedirect = (req, res) => {
	let ru = req.cookies['_ru'];

	if(ru) {
		let redirectURL = cryptr.decrypt(ru);

		if(process.env.NODE_ENV === 'production') {
			res.clearCookie('_ru', { domain: 'streamachievements.com' });
		} else {
			res.clearCookie('_ru');
		}

		if(redirectURL) {
			//Check if trusted
			if(redirectURL.indexOf(process.env.WEB_DOMAIN) != 0) {
				res.redirect(process.env.WEB_DOMAIN + 'home');
			} else {
				res.redirect(redirectURL);
			}
		} else {
			res.redirect(process.env.WEB_DOMAIN + 'home');	
		}
	} else {
		res.redirect(process.env.WEB_DOMAIN + 'home');	
	}
}

let isExpired = (expires) => {
	let expireDate = new Date(expires);
	let today = new Date();

	return today > expireDate;
}

let refreshPatreonToken = (req, refreshToken) => {

	return new Promise((resolve, reject) => {
		let rt = cryptr.decrypt(refreshToken);

		axios.post(`https://www.patreon.com/api/oauth2/token?grant_type=refresh_token&refresh_token=${rt}&client_id=${process.env.PCID}&client_secret=${process.env.PCS}`)
			.then(response => {

				let newAT = cryptr.encrypt(response.data.access_token);
				let newRT = cryptr.encrypt(response.data.refresh_token);
				let today = new Date();
				let newExpires = new Date().setDate(today.getDate() + 14);

				let integration = Object.assign({}, req.user.integration);

				integration.patreon.at = newAT;
				integration.patreon.rt = newRT;
				integration.patreon.expires = newExpires;
				req.user.integration = integration;

				req.user.save().then(savedUser => {

					resolve({
						at: newAT,
						rt: newRT,
						expires: newExpires
					})
				});
				
			}).catch(err => {
				resolve(null);
			});
		
	});
}

let twitchSync = (req, user, etid) => {

	if(user.integration.twitch) {
		return new Promise((resolve, reject) => {

			getTwitchAxiosInstance().then(instance => {

				instance.get(`https://api.twitch.tv/helix/users/?id=${user.integration.twitch.etid}`)
					.then(response => {
						user.name = response.data.data[0].login;
						user.logo = response.data.data[0].profile_image_url;

						user.save().then(savedUser => {

							Channel.findOne({twitchID: savedUser.integration.twitch.etid}).then(foundChannel => {
								if(foundChannel) {
									let update = false;

									if(foundChannel.owner !== savedUser.name) {
										update = foundChannel.owner;
										foundChannel.owner = savedUser.name;
									}

									if(foundChannel.logo !== savedUser.logo) {
										foundChannel.logo = savedUser.logo;
									}

									if(update) {
										
										Achievement.find({channel: update}).then(foundAchievements => {
											if(foundAchievements.length > 0) {
												foundAchievements.forEach(ach => {
													ach.channel = savedUser.name;
													ach.save();
												});
											}
										});

										Listener.find({channel: update}).then(foundListeners => {
											if(foundListeners.length > 0) {
												foundListeners.forEach(list => {
													list.channel = savedUser.name;
													list.save();
												});
											}
										})
										
										emitChannelUpdate(req, {
											old: update,
											new: savedUser.name,
											fullAccess: foundChannel.gold || false
										});
									}

									foundChannel.save().then(savedChannel => {
										resolve({
											username: savedUser.name,
											logo: savedUser.logo
										});		
									});
								} else {
									resolve({
										username: savedUser.name,
										logo: savedUser.logo
									});
								}
							});
						});
					});
				});
		});
	} else {
		return Promise.resolve();
	}
}

let patreonSync = (req, etid) => {
	if(req.user.integration.patreon) {
		return new Promise((resolve, reject) => {
			let {at, rt, id, expires} = req.user.integration.patreon;

			let refreshPromise;

			if(isExpired(expires)) {
				
				refreshPromise = new Promise((res2, rej2) => {
				   refreshPatreonToken(req.user, rt).then(newTokens => {
						
						if(newTokens) {
							at = newTokens.at;
							rt = newTokens.rt;
							expires = newTokens.expires;
						}
						res2();
				   });
				});
			} else {
				refreshPromise = Promise.resolve();
			}

			refreshPromise.then(() => {
				let access_token = cryptr.decrypt(at);

				axios.get(PATREON_IDENTITY_API, {
					headers: {
						Authorization: `Bearer ${access_token}`
					}
				}).then(res => {
					vanity = res.data.data.attributes.vanity,
					thumb_url = res.data.data.attributes.thumb_url

					if(!res.data.included) {
						//patron is not a member of the patreon
						//set at, rt, and thumb_url in DB, display panel to follow
						resolve({
							thumb_url,
							vanity,
							at,
							rt,
							etid
						});
					} else {
						let longID = (res.data.included[0].id);

						axios.get(`https://www.patreon.com/api/oauth2/v2/members/${longID}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`, {
							headers: {
								Authorization: `Bearer ${access_token}`
							}
						}).then(res2 => {
							
							//active_patron, declined_patron, former_patron, null
							let patron_status = res2.data.data.attributes.patron_status;
							let is_follower = res2.data.data.attributes.is_follower;
							let tiers = res2.data.data.relationships.currently_entitled_tiers;
							let isGold = tiers.data.map(tier => tier.id).indexOf(GOLD_TIER_ID) >= 0;

							let patreonData = {
								id: longID,
								thumb_url,
								vanity,
								at,
								rt,
								etid,
								is_follower,
								status: patron_status,
								is_gold: isGold,
								expires
							};

							if(!req.user.integration.patreon.is_gold && isGold) {
								//user became gold, enable on IRC side
								emitBecomeGold(req, req.user.name);
								new Notice({
									user: process.env.NOTICE_USER,
									logo: req.user.logo,
									message: `${req.user.name} just backed on Patreon!!`,
									date: Date.now(),
									type: 'achievement',
									channel: req.user.name,
									status: 'new'
								}).save();
							} else if(req.user.integration.patreon.is_gold && !isGold) {
								//user lost gold status, disable on IRC side
								emitRemoveGold(req, req.user.name);
							} 

							let integration = Object.assign({}, req.user.integration);

							integration.patreon = {...patreonData};

							req.user.integration = integration;

							req.user.save().then(savedUser => {
								if(savedUser.type === 'verified') {
									Channel.findOne({owner: savedUser.name}).then(foundChannel => {
										if(foundChannel.gold !== savedUser.integration.patreon.is_gold) {
											foundChannel.gold = savedUser.integration.patreon.is_gold
											foundChannel.save();	
										}
									});
								}
								
								resolve({
									vanity: savedUser.integration.patreon.vanity,
									thumb_url: savedUser.integration.patreon.thumb_url,
									follower: savedUser.integration.patreon.is_follower,
									status: savedUser.integration.patreon.status,
									gold: savedUser.integration.patreon.is_gold
								});
							});
						});
					}
				});	
			});

			
		});
	} else {
		return Promise.resolve();
	}
}

router.get('/logout', (req, res) => {
	req.logout();
	if(process.env.NODE_ENV === 'production') {
		res.clearCookie('etid', { domain: 'streamachievements.com' });
	} else {
		res.clearCookie('etid');
	}

	res.redirect(process.env.WEB_DOMAIN);
	
});

module.exports = router;
