const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const noticeSchema = new Schema({
	twitchID: String,
	channelID: String,
	achievementID: String,
});

/*
	[
		{
			twitchID: 123456,
			channel: {
			    name: phirehero,
			    logo: path-to-image.png
			},
			achievementID: 123456
		}
	]
*/

const Notice = mongoose.model("notice", noticeSchema);

module.exports = Notice;