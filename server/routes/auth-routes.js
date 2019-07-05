const router = require('express').Router();
const passport = require('passport');
const Cryptr = require('cryptr');
const axios = require('axios');
const cryptr = new Cryptr(process.env.SCK);
const isAuthorized = require('../utils/auth-utils').isAuthorized;
const User = require('../models/user-model');

//patreon
let url = require('url');
let patreon = require('patreon');
let patreonAPI = patreon.patreon;
let patreonOAuth = patreon.oauth;

let patreonOauthClient = patreonOAuth(process.env.PCID, process.env.PCS);

const PATREON_IDENTITY_API = 'https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields%5Buser%5D=thumb_url,vanity';
const SILVER_TIER_ID = '3497636';
const GOLD_TIER_ID = '3497710';

router.get('/twitch', passport.authenticate('twitch', {
	scope: ["user_read"]
}));

//callback for twitch to redirect to
router.get('/twitch/redirect', passport.authenticate('twitch'), (req, res) => {

	req.session.user = req.user;

	//Set Cookie
	let etid = cryptr.encrypt(req.user.integration.twitch.etid);
	
	if(process.env.NODE_ENV === 'production') {
		res.cookie('etid', etid, { maxAge: 4 * 60 * 60 * 1000, httpOnly: false, secure: true, domain: 'streamachievements.com' });
	} else {
		res.cookie('etid', etid, { maxAge: 4 * 60 * 60 * 1000, httpOnly: false });
	}

	//Check if user is a patron, and call out if so
	let patreonInfo = req.user.integration.patreon;
	let patreonPromise;

	if(patreonInfo && patreonInfo.status !== 'lifetime') {
		let {at, rt, id, expires} = patreonInfo;

		let refreshPromise;

		if(isExpired(expires)) {
			console.log('patreon token expired');
			refreshPromise = new Promise((res2, rej2) => {
			   refreshPatreonToken(req.user, patreonInfo.rt).then(newTokens => {
					console.log('token is refreshed');
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
			console.log('getting up to date info from patreon');
			axios.get(`https://www.patreon.com/api/oauth2/v2/members/${id}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`, {
				headers: {
					Authorization: `Bearer ${access_token}`
				}
			}).then(response => {
				console.log('up to date info obtained');
				//active_patron, declined_patron, former_patron, null
				let patron_status = response.data.data.attributes.patron_status;
				let is_follower = response.data.data.attributes.is_follower;
				let tiers = response.data.data.relationships.currently_entitled_tiers;
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

				let integration = Object.assign({}, req.user.integration);

				integration.patreon = {...patreonUpdate};

				req.user.integration = integration;
				req.user.lastLogin = Date.now();
				req.user.save().then(savedUser => {
					res.redirect(process.env.WEB_DOMAIN + 'home');
				});			
			}).catch(error => {
				console.log(error.response.data.errors[0]);
				if(error.response.status === 401) {
					res.redirect('/auth/patreon');
				}
			});
		});

		
	} else {
		req.user.lastLogin = Date.now();

		req.user.save().then(savedUser => {
			res.redirect(process.env.WEB_DOMAIN + 'home');
		});	
	}
	
});

router.get('/patreon', isAuthorized, (req, res) => {
	console.log('why tho?');
	let patreonURL = 'https://www.patreon.com/oauth2/authorize?';
	patreonURL += 'response_type=code&';
	patreonURL += 'client_id=' + process.env.PCID + '&';
	patreonURL += 'redirect_uri=' + process.env.PPR;
	patreonURL += '&scope=campaigns%20identity%20identity%5Bemail%5D%20campaigns.members'

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

		req.user.integration = integration;

		req.user.save().then(savedUser => {
			//2604384
			res.redirect(process.env.WEB_DOMAIN + 'profile');
		});

	});
});

router.post('/patreon/sync', isAuthorized, (req, res) => {
	
	patreonSync(req.user, req.cookies.etid).then((patreonData) => {
		res.json(patreonData);
	});
});

router.post('/patreon/unlink', isAuthorized, (req, res) => {
	let integration = Object.assign({}, req.user.integration);

	delete integration.patreon;

	req.user.integration = integration;

	req.user.save().then(savedUser => {
		res.json({
			success: true,
			service: 'patreon'
		});
	});	
});

let isExpired = (expires) => {
	let expireDate = new Date(expires);
	let today = new Date();

	return today > expireDate;
}

let refreshPatreonToken = (user, refreshToken) => {

	return new Promise((resolve, reject) => {
		let rt = cryptr.decrypt(refreshToken);
		console.log('calling to get a token refresh');
		axios.post(`https://www.patreon.com/api/oauth2/token?grant_type=refresh_token&refresh_token=${rt}&client_id=${process.env.PCID}&client_secret=${process.env.PCS}`)
			.then(response => {
				console.log('token obtained');
				let newAT = cryptr.encrypt(response.data.access_token);
				let newRT = cryptr.encrypt(response.data.refresh_token);
				let today = new Date();
				let newExpires = new Date().setDate(today.getDate() + 14);

				let integration = Object.assign({}, user.integration);

				integration.patreon.at = newAT;
				integration.patreon.rt = newRT;
				integration.patreon.expires = newExpires;
				user.integration = integration;

				user.save().then(savedUser => {
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

let patreonSync = (user, etid) => {
	if(user.integration.patreon) {
		return new Promise((resolve, reject) => {
			let {at, rt, id, expires} = user.integration.patreon;

			let refreshPromise;

			if(isExpired(expires)) {
				
				refreshPromise = new Promise((res2, rej2) => {
				   refreshPatreonToken(user, rt).then(newTokens => {
						
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

							let integration = Object.assign({}, user.integration);

							integration.patreon = {...patreonData};

							user.integration = integration;

							user.save().then(savedUser => {
								//2604384
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
