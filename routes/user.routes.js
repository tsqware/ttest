const express = require("express");
const { check } = require('express-validator');

const userController = require('../controllers/user.controller');
const fileUpload = require('../middleware/file-upload');

const router = express.Router();

router.get('/:uid', userController.getUserById);
router.get('/', userController.getAllUsers);
router.post('/signup',
	fileUpload.single('image'),
	[
		check('name').not().isEmpty().withMessage('Name is required.'),
		check('email').normalizeEmail().isEmail().withMessage('Email must be in email format.'),
		check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.')
	],
	userController.signup);
router.post('/login', userController.login);

module.exports = router;