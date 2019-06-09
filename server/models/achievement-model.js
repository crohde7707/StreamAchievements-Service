const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const achievementSchema = new Schema({
	uid: Number,
	channel: String,
	title: String,
	description: String,
	icon: String,
	earnable: Boolean,
	limited: Boolean,
	secret: Boolean,
	listener: String,
	first: String,
	earned: Date
});

const Achievement = mongoose.model("achievement", achievementSchema);

module.exports = Achievement;

/*
	Listener Codes:
	---------------
	1 - Sub
	2 - Resub
	3 - Gift Sub
	4 - Raid
*/