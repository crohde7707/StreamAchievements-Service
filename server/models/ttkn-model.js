const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var ttknSchema = new Schema({
	at: String,
	expires_in: Number
});

const Ttkn = mongoose.model("ttkn", ttknSchema);

module.exports = Ttkn;