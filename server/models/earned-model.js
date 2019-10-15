const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const earnedSchema = new Schema({
	userID: String,
	channelID: String,
	achievementID: Number,
	earned: Date,
	first: Boolean
});

const Earned = mongoose.model("earned", earnedSchema);

module.exports = Earned;