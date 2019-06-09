const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const imageSchema = new Schema({
	name: String,
	type: String,
	channel: String,
	cloudID: String,
	url: String,
	achievementID: String
});

const Image = mongoose.model("image", imageSchema);

module.exports = Image;