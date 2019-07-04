const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const listenerSchema = new Schema({
	uid: String,
	channel: String,
	achType: String,
	resubType: String,
	bot: String,
	query: Schema.Types.Mixed,
	condition: String,
	achievement: String,
	aid: Number
});

const Listener = mongoose.model("listener", listenerSchema);

module.exports = Listener;

/*
	Listener Types:
	---------------
	1 - Sub
	2 - Resub
	3 - Gift Sub
	4 - Raid
	5 - Query
*/