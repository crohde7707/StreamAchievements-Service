const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
	name: String,
	twitchID: String,
	logo: String,
	email: String,
	type: String,
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
	integration: Object,
	preferences: Object,
	lastLogin: Date
});

const User = mongoose.model("user", userSchema);

module.exports = User;