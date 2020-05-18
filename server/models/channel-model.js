const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const channelSchema = new Schema({
	ownerID: String,
	platforms: {
		twitch: Object,
		mixer: Object
	},
	integrations: {
		streamlabs: Object,
		streamelements: Object
	},
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
		delay: Number,
		custom: Boolean,
		graphic: String,
		layout: Number,
		textColor: String,
		titleFontSize: Number,
		showDescription: Boolean,
		descFontSize: Number
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