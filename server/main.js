const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cookieSession = require('cookie-session');
const passport = require('passport');
const Socket = require('./models/socket-model');
const passportSetup = require('./configs/passport-setup');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const refresh = require('./utils/refresh-cookie').refreshCookie;
const allowAccess = require('./utils/access-utils').allowAccess;

let io = require('socket.io');

let authRoutes = require('./routes/auth-routes');
let apiRoutes = require('./routes/api-routes');

const port = process.env.PORT || 5000;

let app = express();

// set up view engine
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(bodyParser({limit: '50mb', extended: true}));

// connect to mongodb
mongoose.connect(process.env.MDB, {useNewUrlParser: true}, () => {
	console.log('connected to mongodb');
});

app.use(cookieSession({
	name: 'e2tid',
	maxAge: 1000,
	keys: process.env.SCK,
	cookie: {
		httpOnly: true,
		expires: new Date(Date.now() + 60 * 60 * 1000)
	}
}));


//initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static('public'));

app.use('/auth', [allowAccess, refresh], authRoutes);
app.use('/api', [allowAccess, refresh], apiRoutes);

app.use(express.static(path.join(__dirname, 'client/build')));

let server = app.listen(port);

let WebSockets = io.listen(server);

app.set('ws', WebSockets);

WebSockets.on('connection', function (socket) {
    console.log('connected:', socket.client.id);

    socket.on('handshake', function(data) {
    	if(data.name = "SAIRC") {
    		
    		app.set('IRCSOCKET', socket.id);
    		
    	} else if(data.web) {
    		let userSockets = app.get('USERSOCKETS');

    		if(userSockets) {
    			userSockets[data.user] = socket.id;
    		} else {
    			userSockets = {};
    			userSockets[data.user] = socket.id;

    			app.set('USERSOCKETS', userSockets);
    		}
    	}
    });
});

console.log(`Express app listening on port ${port}`)