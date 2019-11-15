const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const channelSchema = new Schema({
	owner: String,
	twitchID: String,
	theme: String,
	logo: String,
	members: Array,
	moderators: [
		{
			uid: String,
			permissions: {
				channel: Boolean,
				chat: Boolean
			}
		}
	],
	icons: {
		default: String,
		hidden: String
	},
	oid: String,
	overlay: {
		chat: Boolean,
		chatMessage: String,
		sfx: String,
		enterEffect: String,
		exitEffect: String,
		duration: Number,
		volume: Number,
		delay: Number
	},
	gold: Boolean,
	nextUID: Number,
	broadcaster_type: {
		twitch: String,
		mixer: String,
		youtube: String
	},
	referral: {
		referred: Number,
		code: String
	}
});

const Channel = mongoose.model("channel", channelSchema);

module.exports = Channel;