// routes/vendorRoutes.js

const express = require('express');
const router = express.Router();

const {
  registerVendor,
  loginVendor,
  getVendorDashboard
} = require('../controllers/vendorController');

const protectVendor = require('../middleware/vendorMiddleware');

// 🟢 تسجيل بائع جديد
router.post('/register', registerVendor);

// 🔐 تسجيل دخول البائع
router.post('/login', loginVendor);

// 📊 لوحة تحكم البائع (محمي)
router.get('/dashboard', protectVendor, getVendorDashboard);

module.exports = router;
