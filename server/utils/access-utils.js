const allowAccess = async (req, res, next) => {
	var allowedOrigins = ['http://www.streamachievements.com', 'http://streamachievements.com', 'https://www.streamachievements.com', 'https://streamachievements.com'];
	var origin = req.headers.origin;

	if(allowedOrigins.indexOf(origin) > -1) {
		res.setHeader('Access-Control-Allow-Origin', origin);
	}

	res.header('Access-Control-Allow-Credentials', true);
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

	next();
}

module.exports = {
	allowAccess
}