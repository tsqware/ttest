const fs = require('fs');
const path = require('path');

const express = require('express');
const mongoose = require('mongoose');

const placeRoutes = require('./routes/place.routes');
const userRoutes = require('./routes/user.routes');
const HttpError = require('./models/http-error');

const MONGODB_URL = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dlacg.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
console.log("dbuser:", process.env.DB_USER);
console.log("dbuser:", process.env.REACT_APP_BASEURL);
console.log("mongodb:", MONGODB_URL);
const app = express();

app.use(express.json());

app.use('/uploads/images', express.static(path.join('uploads', 'images')));

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', process.env.REACT_APP_BASEURL);
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
	console.log("error:", error);

	res.status(error.code || 500);
	res.json({ message: error.message || 'An unknown error occurred.' });
});

mongoose
	.connect(MONGODB_URL)
	.then(() => {
		console.log('DB connection successful!!')
		app.listen(process.env.PORT || 5001);
	})
	.catch(err => {
		console.log("Error connecting to database:\n", err);
	});

