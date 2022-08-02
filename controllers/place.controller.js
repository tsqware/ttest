const fs = require('fs');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');


const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION
});

const getAllPlaces = async (req, res, next) => {
	let places;

	try {
		places = await Place.find();
	} catch (err) {
		const error = new HttpError(
			'Could not fetch any places.', 500
		);
		return next(error);
	}

	if (!places || places.length === 0) {
		const error = new HttpError('No places found.', 500);
		return next(error);
	}

	res.status(201).json({ places });
};

const getPlaceById = async (req, res, next) => {
	const placeId = req.params.pid;
	let place;

	try {
		place = await Place.findById(placeId);
	} catch (err) {
		const error = new HttpError(
			'Could not find a place.', 500
		);
		return next(error);
	}

	if (!place) {
		const error = new HttpError('Could not find a place for the provided place id.', 500);
		return next(error);
	}

	res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
	const userId = req.params.uid;
	/* console.log("userId:", userId); */
	//let places;
	let userWithPlaces;

	try {
		userWithPlaces = await User.findById(userId).populate('places');
	} catch (err) {
		const error = new HttpError(
			'Fetching places failed, please try again.',
			500
		);
		return next(error);
	}

	if (!userWithPlaces || userWithPlaces.places.length === 0) {
		const error = new HttpError('No places found for the provided user id.', 500);
		return next(error);
	}

	userObjectWithPlaces = userWithPlaces.places.map(place => {
		return place.toObject({ getters: true })
	});


	res.json({
		places: userWithPlaces.places.map(place => {
			return place.toObject({ getters: true })
		})
	});
};

const createPlace = async (req, res, next) => {
	/* console.log("req.body:", req.body); */
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		console.log("create validation errors:", errors);
		return next(
			new HttpError('Invalid inputs passed, please check your data.', 422)
		);
	}

	const { title, description, address, imageRaw } = req.body;

	let coordinates;

	try {
		coordinates = await getCoordsForAddress(address);
	} catch (err) {
		console.log("coordinates err:", err);
		return next(err);
	}

	const base64Data = new Buffer.from(imageRaw.replace(/^data:image\/\w+;base64,/, ''), 'base64')
	const type = imageRaw.split(';')[0].split('/')[1];

	const params = {
		Bucket: 'hackr-tsqware',
		Key: `uploads/images/${uuidv4()}.${type}`,
		Body: base64Data,
		ACL: 'public-read',
		ContentEncoding: 'base64',
		ContentType: `image/${type}`
	};

	console.log("params:", params);



	let user;

	const sess = await mongoose.startSession();
	sess.startTransaction();

	await s3.upload(params, async (err, data) => {
		if (err) {
			console.log('S3 UPLOAD ERROR:', err);
			res.status(400).json({ error: 'Upload to S3 failed.' });
			return next(error);

		}

		const createdPlace = new Place({
			title,
			description,
			address,
			location: coordinates,
			creator: req.userData.userId
		});

		console.log('AWS UPLOAD RES DATA', data);
		createdPlace.image.url = data.Location;
		createdPlace.image.key = data.Key;
		console.log("createdPlace:", createdPlace);

		try {
			user = await User.findById(createdPlace.creator);
		} catch (err) {
			console.log("get user err:", err);
			const error = new HttpError(
				'Creating place failed, please try again.',
				500
			);
			s3.deleteObject({
				Bucket: 'hackr-tsqware',
				Key: `uploads/images/${uuidv4()}.${type}`
			}, (err, data) => {
				if (err) {
					console.log("err:", err);
					return next(error);
				}
				console.log("deleteObj data:", data);

			});
			return next(error);
		}

		if (!user) {
			const error = new HttpError(
				'Could not find user.'
			);
			return next(error);
		}

		console.log("user:", user)

		try {
			// 
			// console.log("sess:", sess);

			// 
			await createdPlace.save({ session: sess });
			user.places.push(createdPlace);
			user.save({ session: sess })


		} catch (err) {
			console.log("save place err:", err);
			const error = new HttpError(
				'Creating place failed, please try again.',
				500
			);
			s3.deleteObject({
				Bucket: 'hackr-tsqware',
				Key: `uploads/images/${uuidv4()}.${type}`
			}, (err, data) => {
				console.log("err:", err);
			});


			return next(error);
		}


		res.status(201).json({ place: createdPlace.toObject({ getters: true }) });
	});
	await sess.commitTransaction();
};

const updatePlace = async (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		console.log("update validation errors:", errors);
		return next(new HttpError('Invalid inputs passed, please check your data.', 422));
	}

	/* console.log("pid:", req.params.pid) */

	const { title, description } = req.body;
	const placeId = req.params.pid;

	let place;

	try {
		place = await Place.findById(placeId);
	} catch (err) {
		const error = new HttpError(
			'Could not find place to be updated.', 500
		);
		return next(error);
	}

	if (place.creator.toString() !== req.userData.userId) {
		const error = new HttpError(
			'Not authorized to edit this place.',
			403
		);
		return next(error);
	}

	/* console.log("place:", place); */

	if (!place) {
		const error = new HttpError('Could not find a place for the provided place id.', 500);
		return next(error);
	}

	place.title = title;
	place.description = description;

	try {
		await place.save();
	} catch (err) {
		const error = new HttpError(
			'Could not update place.', 500
		);
		return next(error);
	}

	res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
	const placeId = req.params.pid;
	console.log("DELETE PLACE");
	console.log("placeId:", placeId);

	let place;

	try {
		place = await Place.findById(placeId).populate('creator');
	} catch (err) {
		const error = new HttpError(
			'Could not find place to be deleted.', 500
		);
		return next(error);
	}

	console.log("place:", place);

	if (!place) {
		const error = new HttpError('Could not find a place for the provided place id.', 404);
		return next(error);
	}

	if (place.creator.id !== req.userData.userId) {
		const error = new HttpError(
			'Not authorized to delete this place.',
			403
		);
		return next(error);
	}

	const imagePath = place.image;
	console.log("place:", place);


	try {
		const sess = await mongoose.startSession();

		sess.startTransaction();

		await place.remove({ session: sess });
		place.creator.places.pull(place);
		await place.creator.save({ session: sess });

		await sess.commitTransaction();
	} catch (err) {
		const error = new HttpError(
			'Could not delete place.', 500
		);
		return next(error);
	}

	s3.deleteObject({
		Bucket: 'hackr-tsqware',
		Key: place.image.key
	}, (err, data) => {
		console.log("err:", err);
	});

	res.status(200).json({ message: 'Nothing changes in place.' });
};

exports.getAllPlaces = getAllPlaces;
exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;