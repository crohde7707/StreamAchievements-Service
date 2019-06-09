const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const queueSchema = new Schema({
	twitchID: String,
	channelID: String,
	achievement: String
});

const Queue = mongoose.model("queue", queueSchema);

module.exports = Queue;