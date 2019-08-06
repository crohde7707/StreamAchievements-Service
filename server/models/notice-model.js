const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const noticeSchema = new Schema({
	user: String,
	logo: String,
	message: String,
	date: Date,
	type: String,
	channel: String,
	status: String
});

const Notice = mongoose.model("notice", noticeSchema);

module.exports = Notice;