const passport = require('passport');
const TwitchStrategy = require('passport-twitch.js').Strategy;
const User = require('../models/user-model');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.SCK);

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.use(
	new TwitchStrategy({
		//options for strategy
		clientID: process.env.TCID,
		clientSecret: process.env.TCS,
		callbackURL: process.env.TPR
	}, (accessToken, refreshToken, profile, done) => {
		let e_token = cryptr.encrypt(accessToken);
		let e_refresh = cryptr.encrypt(refreshToken);
		console.log(profile);
		let twitchIntegration = {
			etid: profile.id.toString(),
			token: e_token,
			refresh: e_refresh
		};
		
		User.findOne({'integration.twitch.etid': twitchIntegration.etid}).then((existingUser) => {
			if(existingUser) {
				existingUser.integration.twitch = twitchIntegration;

				if(existingUser.name !== profile.login) {
					existingUser.name = profile.login;
				}

				if(existingUser.logo !== profile.profile_image_url) {
					existingUser.logo = profile.profile_image_url;
				}

				if(existingUser.email !== profile.email) {
					existingUser.email = profile.email;
				}

				if(existingUser.broadcaster_type !== profile.broadcaster_type) {
					existingUser.broadcaster_type = profile.broadcaster_type;
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