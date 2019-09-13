const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);

const endpointMap = {
	'/api/profile': 'profile',
	'/api/achievement/retrieve': 'dashboard',
	'/api/channel/dashboard': 'dashboard',
	'/api/channel/retrieve': 'channel/{channel}',
	'/api/channel/mod': 'mod',
	'/api/channel/mod/retrieve': 'mod/{channel}',
	'/api/achievement/mod/retrieve': 'mod/{channel}'
}

let getRedirectLocation = (req, res) => {
	let {originalUrl, params, query, headers} = req;
	let redirectURL = process.env.WEB_DOMAIN;

	if((headers.origin + '/') === process.env.WEB_DOMAIN) {

		let endpoint = originalUrl.split('?')[0];
		console.log(endpoint);
		if(endpoint) {
			redirectURL += endpointMap[endpoint];

			console.log(redirectURL);

			if(query && query.channel) {
				redirectURL = redirectURL.replace(new RegExp('{channel}', 'gi'), query.channel);
			} else {
				redirectURL = redirectURL.replace(new RegExp('/{channel}', 'gi'), '');
			}

			if(process.env.NODE_ENV === 'production') {
				res.cookie('_ru', cryptr.encrypt(redirectURL), { maxAge: 4 * 60 * 60 * 1000, secure: true, httpOnly: false, domain: 'streamachievements.com' });
			} else {
				res.cookie('_ru', cryptr.encrypt(redirectURL), { maxAge: 4 * 60 * 60 * 1000, httpOnly: false });
			}
		}
	}
}

module.exports = getRedirectLocation;