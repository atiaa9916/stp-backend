const express = require('express');
const router = express.Router();
const { loginAdmin, registerAdmin } = require('../controllers/adminAuthController');

// 📌 تسجيل دخول المسؤولين
router.post('/login', loginAdmin);

// ✅ تسجيل مسؤول رسمي (محمي بمفتاح سري)
router.post('/register', registerAdmin);

module.exports = router;
