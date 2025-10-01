const express = require('express');
const router = express.Router();
const geo = require('../controllers/geocodeController');

// Public endpoints (rate-limit upstream by Nominatim)
router.get('/search', geo.search);
router.get('/reverse', geo.reverse);

module.exports = router;
