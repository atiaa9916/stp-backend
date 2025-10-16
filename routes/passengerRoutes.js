// routes/passengerRoutes.js

const express = require('express');
const router = express.Router();

const {
  registerPassenger,
  loginPassenger,
  getPassengerProfile,
  getPassengerDashboard // ✅ إضافة لوحة التحكم
} = require('../controllers/passengerController');

const protectPassenger = require('../middleware/passengerMiddleware');

// 🟢 تسجيل راكب جديد
router.post('/register', registerPassenger);

// 🔐 تسجيل دخول الراكب
router.post('/login', loginPassenger);

// 👤 جلب بيانات الراكب المحمية
router.get('/profile', protectPassenger, getPassengerProfile);

// 📊 لوحة تحكم الراكب
router.get('/dashboard', protectPassenger, getPassengerDashboard);

module.exports = router;
