const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const User = require('../models/user.model');

const getAllUsers = async (req, res, next) => {
	let users;

	try {
		users = await User.find({}, '-password');
	} catch (err) {
		const error = new HttpError(
			'Could not fetch any users.', 500
		);
		return next(error);
	}

	res.status(201).json({ message: 'Success', users: users.map(u => u.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		const errorMsgs = errors.errors.map((value, index, array) => {
			return value.msg;
		});
		return res.json({ message: "The form could not be sent.", errors: errorMsgs });
	}

	const { name, email, password } = req.body;
	let existingUser;

	try {
		existingUser = await User.findOne({ email: email });
	} catch (err) {
		console.log("err:", err);
		const error = new HttpError(
			'Problem signing up.', 500
		);
		return next(error);
	}

	if (existingUser) {
		const error = new HttpError(
			'User already exists.', 422
		);
		return next(error);
	}

	let hashedPassword;
	try {
		hashedPassword = await bcrypt.hash(password, 12);
	} catch (err) {
		const error = new HttpError(
			'Could not create user, please try again.'
		);
		return next(error);
	}

	const createdUser = new User({
		name,
		email,
		password: hashedPassword,
		image: req.file.path,
		places: []
	});

	try {
		await createdUser.save();
	} catch (err) {
		const error = new HttpError(
			'Problem completing signup.', 500
		);
		return next(error);
	}

	let token;

	try {
		token = jwt.sign(
			{ userId: createdUser.id, email: createdUser.email },
			process.env.JWT_KEY,
			{ expiresIn: '1h' }
		);
	} catch (err) {
		console.log("signup jwt err:", err);
		const error = new HttpError(
			'Problem completing signup.', 500
		);
		return next(error);
	}

	res.status(201).json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
	const errors = validationResult(req);
	const { email, password } = req.body;
	let existingUser;

	try {
		existingUser = await User.findOne({ email: email });
	} catch (err) {
		console.log("login err:", err);
		const error = new HttpError(
			'Problem logging in.', 500
		);
		return next(error);
	}

	console.log("existing user obj:", existingUser);

	if (!existingUser) {
		const error = new HttpError(
			'Invalid credentials, login failed.', 401
		);
		return next(error);
	}

	let isValidPassword = false;
	try {
		isValidPassword = await bcrypt.compare(password, existingUser.password);
	} catch (err) {
		const error = new HttpError(
			'There was a problem attempt to log in.', 500
		);
		return next(error);
	}

	if (!isValidPassword) {
		const error = new HttpError(
			'Invalid credentials, login failed.', 401
		);
		return next(error);
	}

	existingUser = existingUser.toObject({ getters: true });
	console.log("existingUser:", existingUser);

	let token;

	try {
		token = jwt.sign(
			{ userId: existingUser.id, email: existingUser.email },
			process.env.JWT_KEY,
			{ expiresIn: '1h' }
		);
	} catch (err) {
		const error = new HttpError(
			'Problem completing login.', 500
		);
		return next(error);
	}

	res.json({ userId: existingUser.id, email: existingUser.email, token: token });
}

const getUserById = (req, res, next) => {
	const userId = req.params.pid;
	const user = User.findById(userId);

	if (!user) {
		throw new HttpError('Could not find a user for the provided user id.', 404);
	}

	res.json({ user });
};


exports.getAllUsers = getAllUsers;
exports.signup = signup;
exports.login = login;
exports.getUserById = getUserById;