const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const listenerSchema = new Schema({
	uid: String,
	channel: String,
	cid: String,
	achType: String,
	resubType: String,
	bot: String,
	bots: {
		bot0: String,
		bot1: String,
		bot2: String
	},
	query: Schema.Types.Mixed,
	condition: String,
	queries: {
		query0: Schema.Types.Mixed,
		query1: Schema.Types.Mixed,
		query2: Schema.Types.Mixed
	},
	conditions: {
		condition0: Schema.Types.Mixed,
		condition1: Schema.Types.Mixed,
		condition2: Schema.Types.Mixed
	},
	achievement: String,
	aid: Number,
	unlocked: Boolean
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