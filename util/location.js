const axios = require('axios');
const HttpError = require('../models/http-error');

let API_KEY = process.env.GOOGLE_API_KEY;

async function getCoordsForAddress(address) {
	console.log("address:", address);
	console.log("API_KEY:", API_KEY);
	const response = await axios.get(
		`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
	);

	console.log("response:", response);

	const data = response.data;

	if (!data || data.status === 'ZERO RESULTS') {
		const error = new HttpError('Could not find location for address entered.', 422);
		throw error;
	}

	const coordinates = data.results[0].geometry.location;

	return coordinates;
}

module.exports = getCoordsForAddress;