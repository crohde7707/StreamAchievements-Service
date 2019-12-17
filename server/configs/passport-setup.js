const passport = require('passport');
const TwitchStrategy = require('passport-twitch.js').Strategy;
const User = require('../models/user-model');
const Channel = require('../models/channel-model');
const Notice = require('../models/notice-model');
const Earned = require('../models/earned-model');
const Achievement = require('../models/achievement-model');
const Listener = require('../models/listener-model');
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
		let twitchIntegration = {
			etid: profile.id.toString(),
			token: e_token,
			refresh: e_refresh
		};
		
		User.findOne({'integration.twitch.etid': twitchIntegration.etid}).then((existingUser) => {
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

				existingUser.save().then(savedUser => {

					Channel.findOne({twitchID: savedUser.integration.twitch.etid}).then(foundChannel => {

						if(foundChannel) {
							let ownerUpdate = false;

							if(foundChannel.owner !== savedUser.name) {
								updated = true;
								ownerUpdate = foundChannel.owner;
								foundChannel.owner = savedUser.name;
							}

							if(foundChannel.logo !== savedUser.logo) {
								updated = true;
								foundChannel.logo = savedUser.logo;
							}

							foundChannel.save().then(savedChannel => {
								if(updated) {
									new Notice({
										user: savedUser._id,
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
										
										savedUser.update = {
											old: ownerUpdate,
											new: savedChannel.owner
										}	
									}

									done(null, savedUser);

								} else {
									done(null, savedUser);
								}
							});
						} else {
							if(updated) {
								new Notice({
									user: savedUser._id,
									logo: "https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png",
									message: "We noticed some information has been updated on Twitch, so we went ahead and updated your profile with those changes!",
									date: Date.now(),
									type: 'profile',
									status: 'new'
								}).save();
							}

							done(null, savedUser);
						}
					});
				});
			} else {
				new User({
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
				}).save().then((newUser) => {

					done(null, newUser);

				});		
			}
		})

		
	})
)