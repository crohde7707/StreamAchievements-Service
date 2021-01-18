const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const achievementSchema = new Schema({
	uid: Number,
	channel: String,
	cid: String,
	title: String,
	description: String,
	shortDescription: String,
	icon: String,
	earnable: Boolean,
	limited: Boolean,
	secret: Boolean,
	listener: String,
	first: String,
	earned: Date,
	alert: Boolean,
	order: Number,
	rank: Number
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

/*
    Rank Codes:
    -------------
    0 - Bronze
    1 - Silver
    2 - Gold
    3 - Platnium
    4 - Feat (not ranked)
*/