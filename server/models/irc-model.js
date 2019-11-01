const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var ircSchema = new Schema({
	at: String,
	rt: String,
	last: Date,
	expires_in: Number
});

const Irc = mongoose.model("irc", ircSchema);

module.exports = Irc;