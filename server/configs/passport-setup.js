const passport = require('passport');
const TwitchStrategy = require('passport-twitch').Strategy;
const keys = require('./keys');
const User = require('../models/user-model');
const Cryptr = require('cryptr');

const cryptr = new Cryptr(keys.session.cookieKey);

const SESSION_SECRET = process.env.SESSION_SECRET;
const CALLBACK_URL = 'http://localhost:5000/auth/twitch/redirect';

passport.serializeUser((user, done) => {
	console.log("serializeUser");
	done(null, user);
});

// passport.deserializeUser((etid, done) => {
// 	console.log("deserializeUser");
// 	User.findOne({'integration.twitch.etid': etid}).then((foundUser) => {
// 		if(foundUser) {
// 			console.log(foundUser);
// 			done(null, foundUser);
// 		} else {
// 			done(null, null);
// 		}
// 	});
// });

passport.use(
	new TwitchStrategy({
		//options for strategy
		clientID: keys.twitch.clientID,
		clientSecret: keys.twitch.clientSecret,
		callbackURL: CALLBACK_URL
	}, (accessToken, refreshToken, profile, done) => {

		console.log(profile);

		let e_token = cryptr.encrypt(accessToken);
		let e_refresh = cryptr.encrypt(refreshToken);

		let twitchIntegration = {
			etid: profile.id.toString(),
			token: e_token,
			refresh: e_refresh
		};
		
		User.findOne({'integration.twitch.etid': twitchIntegration.etid}).then((existingUser) => {
			if(existingUser) {
				existingUser.integration.twitch = twitchIntegration;

				if(existingUser.name !== profile.username) {
					existingUser.name = profile.username;
				}

				if(existingUser.logo !== profile['_json'].logo) {
					existingUser.logo = profile['_json'].logo;
				}

				if(existingUser.email !== profile.email) {
					existingUser.email = profile.email;
				}

				existingUser.save().then(savedUser => {
					console.log("found user, logging in...");
					done(null, existingUser);	
				});
			} else {
				new User({
					name: profile.username,
					logo: profile['_json'].logo,
					email: profile.email,
					type: 'user',
					channels: [],
					integration: {
						twitch: twitchIntegration
					}
				}).save().then((newUser) => {
					done(null, newUser);
				});		
			}
		})

		
	})
)