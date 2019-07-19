const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const channelSchema = new Schema({
	owner: String,
	twitchID: String,
	theme: String,
	logo: String,
	members: Array,
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
		volume: Number
	},
	nextUID: Number
});

const Channel = mongoose.model("channel", channelSchema);

module.exports = Channel;