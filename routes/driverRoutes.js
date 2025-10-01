const express = require('express');
const router = express.Router();

const { getDriverDashboard } = require('../controllers/driverController');
const { protectDriver } = require('../middleware/driverMiddleware');
const { registerDriver, loginDriver } = require('../controllers/driverAuthController'); // ✅ استدعاء موحد

// 📊 لوحة تحكم السائق
router.get('/dashboard/:driverId', protectDriver, getDriverDashboard);

// 🔐 تسجيل وإنشاء حساب السائق
router.post('/register', registerDriver);
router.post('/login', loginDriver);

module.exports = router;
