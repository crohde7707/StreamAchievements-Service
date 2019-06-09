const router = require('express').Router();
const passport = require('passport');
const keys = require('../configs/keys');
const Cryptr = require('cryptr');
const axios = require('axios');
const cryptr = new Cryptr(keys.session.cookieKey);
const isAuthorized = require('../utils/auth-utils').isAuthorized;
const User = require('../models/user-model');

//patreon
let url = require('url');
let patreon = require('patreon');
let patreonAPI = patreon.patreon;
let patreonOAuth = patreon.oauth;

let patreonOauthClient = patreonOAuth(keys.patreon2.clientID, keys.patreon2.clientSecret);

const CALLBACK_URL = 'http://localhost:5000/auth/patreon/redirect';
const PATREON_IDENTITY_API = 'https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields%5Buser%5D=thumb_url,vanity';
const SILVER_TIER_ID = '3497636';
const GOLD_TIER_ID = '3497710';

router.get('/twitch', passport.authenticate('twitch', {
	scope: ["user_read"]
}));

//callback for twitch to redirect to
router.get('/twitch/redirect', passport.authenticate('twitch'), (req, res) => {

	req.session.user = req.user;

	//req.session.save();

	//Set Cookie
	var cookie = req.cookies['etid'];
	if (cookie === undefined || cookie !== req.user.integration.twitch.etid) {
		let etid = cryptr.encrypt(req.user.integration.twitch.etid);
		// no: set a new cookie
		res.cookie('etid', etid, { maxAge: 24 * 60 * 60 * 1000, httpOnly: false });
	} else {
		// yes, cookie was already present 
		console.log('cookie exists', cookie);
	} 

	res.redirect('http://localhost:3000/home');

});

router.get('/patreon', isAuthorized, (req, res) => {

	let patreonURL = 'https://www.patreon.com/oauth2/authorize?';
	patreonURL += 'response_type=code&';
	patreonURL += 'client_id=' + keys.patreon2.clientID + '&';
	patreonURL += 'redirect_uri=' + CALLBACK_URL;
	patreonURL += '&scope=campaigns%20identity%20identity%5Bemail%5D%20campaigns.members'

	res.redirect(patreonURL);
});

router.get('/patreon/redirect', isAuthorized, (req, res) => {
	let oauthGrantCode = req.query.code;

	return patreonOauthClient.getTokens(oauthGrantCode, CALLBACK_URL).then(tokenResponse => {
		let patreonAPIClient = patreonAPI(tokenResponse.access_token)
		let etid = (req.cookies.etid);

		return new Promise((resolve, reject) => {
							
			let at = cryptr.encrypt(tokenResponse.access_token);
			let rt = cryptr.encrypt(tokenResponse.refresh_token);
			
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
							is_gold: isGold
						});
					});
				}
			});
		});
	}).then(patreonData => {
		
		let {id, thumb_url, vanity, at, rt, etid, is_follower, status, is_gold} = patreonData;

		let integration = Object.assign({}, req.user.integration);

		integration.patreon = {id, thumb_url, vanity, at, rt, is_follower, status, is_gold};

		req.user.integration = integration;

		req.user.save().then(savedUser => {
			//2604384
			res.redirect('http://localhost:3000/profile');
		});

	});
});

router.post('/patreon/sync', isAuthorized, (req, res) => {
	
	patreonSync(req.user, req.cookies.etid).then((user) => {
		res.json({
			message: 'return back updated patreon data to store'
		});
	})
});

let patreonSync = (user, etid) => {
	if(user.integration.patreon) {
		return new Promise((resolve, reject) => {
			let {at, rt, id} = user.integration.patreon;

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
							is_gold: isGold
						};

						let integration = Object.assign({}, user.integration);

						integration.patreon = {...patreonData};

						user.integration = integration;

						user.save().then(savedUser => {
							//2604384
							resolve(savedUser);
						});
					});
				}
			});	
		});
	} else {
		return Promise.resolve();
	}
}

router.get('/logout', (req, res) => {
	req.logout();
	res.clearCookie('etid');
	res.redirect('http://localhost:3000/');
});

module.exports = router;
