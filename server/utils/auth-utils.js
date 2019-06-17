const User = require('../models/user-model');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);

const authCheck = (req, res, next) => {
	if(!req.user) {
		res.redirect('/auth/twitch');
	} else {
		next();
	}
}

const isAuthorized = async (req, res, next) => {
	let etid = cryptr.decrypt(req.cookies.etid);

	let foundUser = await User.findOne({'integration.twitch.etid': etid})
			
	if(foundUser) {
		req.user = foundUser;
		res.cookie('etid', req.cookies.etid, { maxAge: 24 * 60 * 60 * 1000, httpOnly: false, domain: 'streamachievements.com' });
		next();
	} else {
		res.clearCookie('etid'); //set path to streamachievements.com when ready
		res.status(401);
		res.redirect('http://streamachievements.com');
	}
}

const isAdminAuthorized = async (req, res, next) => {
	let etid = cryptr.decrypt(req.cookies.etid);

	let foundUser = await User.findOne({'integration.twitch.etid': etid})
			
	if(foundUser) {
		if(foundUser.type = 'admin') {
			res.user = foundUser;
			res.cookie('etid', req.cookies.etid, { maxAge: 24 * 60 * 60 * 1000, httpOnly: false, domain: 'streamachievements.com' });
			next();
		} else {
			res.status(401);
			res.json({
				message: "You are not authorized to make this request."
			});
			next();
		}
		
	} else {
		res.status(401);
		res.json({
			message: "You are not authorized to make this request."
		});
		next();
	}
}

module.exports = {
	authCheck: authCheck,
	isAuthorized,
	isAdminAuthorized
}