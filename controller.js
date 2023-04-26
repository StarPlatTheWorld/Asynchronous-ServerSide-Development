//const values for requiring libraries//
const mysql = require('mysql');
const passport = require('passport');
const { Strategy } = require('passport-local');
const bcrypt = require('bcrypt');
const multer = require('multer')();
const fs = require('fs');

//creates sql database connection//
const conn = mysql.createConnection({
    host:'localhost',
    user: 'root',
    password: '',
    database: 'imagegallery'
});

//connects to the database, if error then display error message//
//generates tables within the database//
conn.connect((err) => {
    if (err) {
        console.error('Error connecting to database: ' + err.stack);
        return;
    }
    conn.query('CREATE TABLE IF NOT EXISTS users(user VARCHAR(40), passhash VARCHAR(255), admin BOOL, PRIMARY KEY(user));');
    conn.query('CREATE TABLE IF NOT EXISTS images(id INT AUTO_INCREMENT, name VARCHAR(50), views INT, alt VARCHAR(50), PRIMARY KEY(id));');
    conn.query('CREATE TABLE IF NOT EXISTS comments(comment VARCHAR(255), user VARCHAR(40), image INT, FOREIGN KEY (user) REFERENCES users(user), FOREIGN KEY (image) REFERENCES images(id));');
    console.log('Connected to the database');
});

//stores user data in the session//
passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(user, done) {
    done(null, user);
});

//selects user data from inputs and compares it to data stored in database//
//if information entered does not exist within the database then an error is flagged//
passport.use(
    new Strategy(
        async function(username, password, done) {
            conn.query('SELECT * from users WHERE user = ?', [username], (err, rows) => {
                if (err) 
                    return done(err, null);
                if (!rows.length)
                    return done('Username or Password is invalid', null);
                if (bcrypt.compareSync(password, rows[0].passhash))
                    return done(null, rows[0]);
                done('Username or Password is invalid', null);
            });
        }
    )
);

//exports the home page and grabs image data from database to render images//
exports.homePage = [
    (req, res) => {
        conn.query('SELECT * FROM images', [], (err, images) => {
            if (err) {
                return res.render('error.ejs')
            }
            res.render('index', { images: images || [], user: req.user });
        });
    }
];

//exports the login page//
exports.loginPage = (req, res) => {
    res.render('login', { user: req.user });
};

//exports the signup page//
exports.signupPage = (req, res) => {
    res.render('signup', { user: req.user });
};

//exports the image view page//
//grabs image data from database, increments the image view count by 1, displays comments posted by users//
exports.imageViewPage = (req, res) => {
    conn.query('SELECT * FROM images WHERE id = ?', [req.params.imageId], (err, images) => {
        const image = images[0];
        image.views += 1;
        conn.query('UPDATE images SET views = ? WHERE id = ?', [image.views, image.id]);
        conn.query('SELECT * FROM comments WHERE image = ?', [image.id], (err, comments) => {
            res.render('imageView', { image, user: req.user, comments });  
        });

    });
};

//exports upload image page//
//denies user access to this page if user isn't logged in//
exports.uploadPage = (req, res) => {
    if (!req.user)
        return res.redirect('/');
    res.render('imageUpload', { user: req.user });
};

//exports the sign up page//
//if user is already logged in and try to access this page, redirects to index//
//if there is no data filled in the sign up, flag error saying fields need to be filled out//
//if password doesn't match confirm password field, error saying passwords do not match//
//if all fields filled correctly, hash the password with bcrypt, store username, hashed password, and user value in database//
exports.postSignUp = [
    async(req, res, next) => {
        if (req.user)
            return res.status(302).redirect('/');
        if (!req.body.username || !req.body.password || !req.body.passwordCon) {
            req.session.error = 'Please ensure that all fields are filled out';
            return res.status(400).redirect('/signup');
        }
        if (req.body.password != req.body.passwordCon) {
            req.session.error = 'Passwords do not currently match';
            return res.status(400).redirect('/signup');
        }
        const hash = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync());
        conn.query('INSERT INTO users values(?, ?, ?)', [req.body.username, hash, false]);
        next();
    },
    passport.authenticate('local', { failureRedirect: '/signup', failureMessage: true, successReturnToOrRedirect: '/' })
];

//exports the post login//
//if user information exists, redirect to index//
//if no data is entered into the form, flag an error and redirect back to login//
exports.postLogin = [
    async(req, res, next) => {
        if (req.user)
            return res.status(302).redirect('/');
        if (!req.body.username || !req.body.password) {
            req.session.error = 'Please ensure that all fields are filled out';
            return res.status(400).redirect('/login');
        }
        next();
    },
    passport.authenticate('local', { failureRedirect: '/login', failureMessage: true, successReturnToOrRedirect: '/' })
];

//exports the get logout//
//if user requests to logout, redirect to a session of index with no stored user data//
exports.getLogout = [
    async(req, res) => {
        req.logOut((err) => {
            if (err) {
                console.error(err);
            }
        });
        res.status(200).redirect('/');
    }
];

//exports post image comments//
//if no logged in user, redirect to login page//
//selects all values from images table//
//if no image exists, error saying no image available//
//inserts input into comment table and updates the current values, redirects back to current image//
exports.postImageComments = [
    async(req, res) => {
        if (!req.user)
            return res.status(401).redirect('/login');
        conn.query('SELECT * FROM images WHERE id = ?', [req.params.imageId], (err, images) => {
            const image = images[0];
            if (!image) {
                req.session.error = 'There Is No Image Available';
                return res.render('imageView.ejs', { image, user : req.user });
            }
            conn.query('INSERT INTO comments (comment, user, image) VALUES (?, ?, ?);', [req.body.imageComment, req.user.user, image.id]);
            res.status(200).redirect(`/imageView/${image.id}`);
            });
    }
];

//exports post image upload//
//if no user is logged in, redirect to login page//
//utilizes multer to parse files//
//if no image is chosen and/or no description is given, redirect to upload page//
//adds image to public folder, inserts image into database with name, views, and alt description//
//redirects to index//
exports.postUploadImage = [
    multer.single('upload'),
    async(req, res) => {
        if (!req.user)
            return res.status(401).redirect('/login')
        if (!req.file?.buffer || !req.body.imgDesc) {
            return res.status(400).redirect('/imageUpload');
        }
        fs.writeFileSync(`${__dirname}/public/images/${req.file.originalname}`, req.file.buffer);
        conn.query('INSERT INTO images (name, views, alt) VALUES (?, ?, ?);', [req.file.originalname, 0, req.body.imgDesc]);
        res.status(200).redirect('/');
    }
];

exports.postAdminEdit = [
    async(req, res) => {
         if (!req.user?.admin)
             return res.status(401).redirect('/login');
        conn.query('SELECT * FROM images WHERE id = ?', [req.params.imageId], (err, images) => {
            if (err)
                return console.error(err);
            const image = images[0];
            if (!image) {
                req.session.error = 'There Is No Image Available';
                return res.render('imageView.ejs', { image, user : req.user });
            }
            if (!req.body.imgDesc) {
                req.session.error = 'Please fill out all fields';
                return res.render('imageView.ejs', { image, user : req.user });
            }
            conn.query('UPDATE images SET alt = ? WHERE id = ?', [req.body.imgDesc, req.params.imageId]);
            res.status(200).redirect(`/imageView/${req.params.imageId}`);
        });
    }
];

exports.postAdminDelete = [
    async(req, res) => {
         if (!req.user?.admin)
             return res.status(401).redirect('/login');
        conn.query('SELECT * FROM images WHERE id = ?', [req.params.imageId], (err, images) => {
            if (err)
                return console.error(err);
            const image = images[0];
            if (!image) {
                req.session.error = 'There Is No Image Available';
                return res.render('imageView.ejs', { image, user : req.user });
            }
            conn.query('DELETE FROM images WHERE id = ?', [req.params.imageId]);
            res.status(200).redirect('/');
        });
    }
];
