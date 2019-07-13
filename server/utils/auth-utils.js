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
	if(req.cookies.etid) {
		let etid = cryptr.decrypt(req.cookies.etid);

		let foundUser = await User.findOne({'integration.twitch.etid': etid})
				
		if(foundUser) {
			req.user = foundUser;
			
			if(process.env.NODE_ENV === 'production') {
				res.cookie('etid', req.cookies.etid, { maxAge: 4 * 60 * 60 * 1000, secure: true, httpOnly: false, domain: 'streamachievements.com' });
			} else {
				res.cookie('etid', req.cookies.etid, { maxAge: 4 * 60 * 60 * 1000, httpOnly: false });
			}
			next();
		} else {
			res.clearCookie('etid'); //set path to streamachievements.com when ready
			res.status(401);
			res.redirect(process.env.WEB_DOMAIN);
		}	
	} else {
		res.status(401);
		res.redirect(process.env.WEB_DOMAIN);
	}
	
}

const isAdminAuthorized = async (req, res, next) => {
	let etid = cryptr.decrypt(req.cookies.etid);

	let foundUser = await User.findOne({'integration.twitch.etid': etid})
			
	if(foundUser) {
		if(foundUser.type = 'admin') {
			res.user = foundUser;
			if(process.env.NODE_ENV === 'production') {
				res.cookie('etid', req.cookies.etid, { maxAge: 4 * 60 * 60 * 1000, secure: true, httpOnly: false, domain: 'streamachievements.com' });
			} else {
				res.cookie('etid', req.cookies.etid, { maxAge: 4 * 60 * 60 * 1000, httpOnly: false });
			}
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