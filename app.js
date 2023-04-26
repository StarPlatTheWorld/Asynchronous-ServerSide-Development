//const values for requiring libraries//
const express = require('express');
const app = express();
const controller = require ('./controller');
const session = require('express-session');
const { MemoryStore } = require('express-session');
const passport = require("passport");
const expressListRoutes = require('express-list-routes');
const port = 3000;

//app set and use routing//
app.set('view engine', 'ejs');
app.use('/public', express.static('public'));
app.set('views', 'views');
app.engine('ejs', require('ejs').renderFile);
app.use(session({
    secret: 'session-of_secrets',
    store: new MemoryStore(),
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));

//app routes & controller imports
app.get('/', controller.homePage);
app.get('/login', controller.loginPage);
app.post('/login', ...controller.postLogin);
app.get('/logout', ...controller.getLogout);
app.get('/signup', controller.signupPage);
app.post('/signup', ...controller.postSignUp);
app.get('/imageView/:imageId', controller.imageViewPage);
app.post('/imageView/:imageId/comments', controller.postImageComments);
app.post('/imageView/:imageId', ...controller.postAdminEdit);
app.post('/imageView/:imageId/delete', ...controller.postAdminDelete);
app.get('/imageUpload', controller.uploadPage);
app.post('/imageUpload', ...controller.postUploadImage);

//app console logging//
app.listen(port, () => {
    console.log(`App is listening on port ${port}`);
});

//console log for post and get requests//
expressListRoutes(app, { prefix: '/api/v1'});