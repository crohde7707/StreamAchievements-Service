const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const socketSchema = new Schema({
	socketID: String,
	name: String
});

const Socket = mongoose.model("socket", socketSchema);

module.exports = Socket;