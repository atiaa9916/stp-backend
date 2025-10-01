const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// 🔐 تسجيل مستخدم جديد
router.post('/register', registerUser);

// 🔐 تسجيل الدخول
router.post('/login', loginUser);

// 👤 جلب الملف الشخصي للمستخدم (اختياري)
router.get('/profile', protect, getUserProfile);

// ⚠️ مؤقت فقط للاختبار (احذفه لاحقًا)
router.get('/all', async (req, res) => {
  const users = await require('../models/User').find({});
  res.json(users);
});

module.exports = router;
