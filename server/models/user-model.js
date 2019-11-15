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
			sync: Boolean,
			banned: Boolean
		}
	],
	favorites: Array,
	delegate: Array,
	integration: {
		twitch: Object,
		patreon: Object,
		streamlabs: Object
	},
	preferences: {
		autojoin: Boolean
	},
	lastLogin: Date,
	new: Boolean,
	consent: {
		date: Date,
		needed: Boolean
	}
});

const User = mongoose.model("user", userSchema);

module.exports = User;