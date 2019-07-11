const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const queueSchema = new Schema({
	twitchID: String,
	name: String,
	channelID: String,
	achievementID: String
});

const Queue = mongoose.model("queue", queueSchema);

module.exports = Queue;