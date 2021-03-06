const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var tokenSchema = new Schema({
	uid: String,
	token: String,
	referral: String,
	created: Date,
	notified: Boolean
});

tokenSchema.methods.hasExpired = function() {
    var now = Date.now();
    return (now - Date.parse(this.created)) > 172800000;
};

const Token = mongoose.model("token", tokenSchema);

module.exports = Token;