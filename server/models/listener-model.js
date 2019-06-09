const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const listenerSchema = new Schema({
	channel: String,
	code: String,
	type: String,
	bot: String,
	query: Schema.Types.Mixed,
	condition: String,
	achievement: String
});

const Listener = mongoose.model("listener", listenerSchema);

module.exports = Listener;

/*
	Listener Codes:
	---------------
	1 - Sub
	2 - Resub
	3 - Gift Sub
	4 - Raid
	5 - Query
*/