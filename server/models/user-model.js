const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
	name: String,
	twitchID: String,
	logo: String,
	email: String,
	type: String,
	broadcaster_type: String,
	channels: [
		{
			channelID: String,
			achievements: [
				{
					aid: Number,
					earned: Date
				}
			],
			sync: Boolean
		}
	],
	integration: {
		twitch: Object,
		patreon: Object
	},
	preferences: {
		autojoin: Boolean
	},
	lastLogin: Date
});

const User = mongoose.model("user", userSchema);

module.exports = User;