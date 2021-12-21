const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var ircSchema = new Schema({
	accessToken: String,
	refreshToken: String,
	expiresIn: Number,
	obtainmentTimestamp: Number
});

const Irc = mongoose.model("irc", ircSchema);

module.exports = Irc;