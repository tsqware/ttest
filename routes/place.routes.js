const express = require("express");
const { check } = require('express-validator');

const placeController = require('../controllers/place.controller')

const router = express.Router();
const fileUpload = require('../middleware/file-upload');
const checkAuth = require('../middleware/check-auth');

router.get('/:pid', placeController.getPlaceById);
router.get('/user/:uid', placeController.getPlacesByUserId);
router.get('/', placeController.getAllPlaces);

router.use(checkAuth);

router.post(
	'/',
	fileUpload.single('image'),
	[
		check('title').not().isEmpty().withMessage('Title is required.'),
		check('description').isLength({ min: 5 }).withMessage('Description must be at least 5 characters.'),
		check('address').not().isEmpty().withMessage('Address is required.')
	],
	placeController.createPlace
);

router.patch('/:pid',
	[
		check('title').not().isEmpty().withMessage('Title is required.'),
		check('description').isLength({ min: 5 }).withMessage('Description must be at least 5 characters.'),
	],
	placeController.updatePlace
);

router.delete('/:pid', placeController.deletePlace);

module.exports = router;