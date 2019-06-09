const refreshCookie = async (req, res, next) => {
	console.log(req.session);
	req.session.fake = Date.now();
	next();
}

module.exports = {
	refreshCookie
}