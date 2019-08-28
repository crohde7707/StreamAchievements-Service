const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cookieSession = require('cookie-session');
const passport = require('passport');
const Socket = require('./models/socket-model');
const passportSetup = require('./configs/passport-setup');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const allowAccess = require('./utils/access-utils').allowAccess;
const {
    searchChannels,
    searchMembers,
    searchMod,
    storeSocket,
    removeSocket,
    markNotificationRead,
    deleteNotification
} = require('./utils/client-socket-utils');

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

//initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static('public'));

app.use('/auth', [allowAccess], authRoutes);
app.use('/api', [allowAccess], apiRoutes);

app.use(express.static(path.join(__dirname, 'client/build')));

let server = app.listen(port);

let WebSockets;

if(process.env.NODE_ENV === 'production') {
    WebSockets = io.listen(process.env.SOCKET_PORT);
} else {
    WebSockets = io.listen(server);
}

app.set('ws', WebSockets);

WebSockets.on('connection', function (socket) {
    
    if(socket.handshake && socket.handshake.query) {
        //Socket coming from overlay-panel
        storeSocket(socket, app);
    }

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

    socket.on('search-directory', (data) => {
        searchChannels(socket, data);
    });

    socket.on('search-gift-member', (data) => {
        searchMembers(socket, data);
    });

    socket.on('search-mod', (data) => {
        searchMod(socket, data);
    });

    socket.on('mark-notification-read', (notification) => {
        markNotificationRead(socket, notification);
    });

    socket.on('delete-notification', (notification) => {
        deleteNotification(socket, notification);
    });

    socket.on('disconnect', () => {
        removeSocket(socket, app);
    });
});

console.log(`Express app listening on port ${port}`)