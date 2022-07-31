const fs = require('fs');
const path = require('path');

const express = require('express');
const mongoose = require('mongoose');

const placeRoutes = require('./routes/place.routes');
const userRoutes = require('./routes/user.routes');
const HttpError = require('./models/http-error');

//const MONGODB_URL = 'mongodb://terrenceadmin:AtLANta21%40!@localhost:27017/places?authSource=admin&authMechanism=DEFAULT'
const MONGODB_URL = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dlacg.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const app = express();

app.use(express.json());

app.use('/uploads/images', express.static(path.join('uploads', 'images')));

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept, Authorization'
	);
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
	next();
});

app.use('/api/places', placeRoutes);
app.use('/api/users', userRoutes);

app.use((req, res, next) => {
	const error = new HttpError('Could not find this route.', 404);
	throw error;
});

app.use((error, req, res, next) => {
	if (req.file) {
		fs.unlink(req.file.path, (err) => {
			console.log(err);
		});
	}
	if (res.headerSent) {
		return next(error);
	}
	/* console.log("error:", error); */

	res.status(error.code || 500);
	res.json({ message: error.message || 'An unknown error occurred.' });
});

mongoose
	.connect(MONGODB_URL)
	.then(() => {
		console.log('DB connection successful!!')
		app.listen(5001);
	})
	.catch(err => {
		console.log("Error connecting to database:\n", err);
	});

