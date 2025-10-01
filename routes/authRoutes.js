const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');

// مسارات التوثيق
router.post('/register', registerUser); // إنشاء حساب جديد
router.post('/login', loginUser);       // تسجيل الدخول

module.exports = router;
