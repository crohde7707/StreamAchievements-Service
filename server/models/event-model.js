const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eventSchema = new Schema({
	channelID: String,
	member: String,
	achievement: String,
	date: Date
});

const Event = mongoose.model("event", eventSchema);

module.exports = Event;