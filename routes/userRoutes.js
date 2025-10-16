// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getUserProfile } = require('../controllers/userController');

/**
 * ملاحظة:
 * التسجيل/الدخول محصوران الآن في /api/auth/*
 * (انظر routes/authRoutes.js + controllers/authController.js)
 * هنا نُبقي فقط المسارات الخاصة بالملف الشخصي وما شابه.
 */

// 👤 جلب الملف الشخصي للمستخدم
router.get('/profile', protect, getUserProfile);

// ⚠️ (اختياري) احذف هذا لاحقًا إن لم تعد بحاجة لفحص كل المستخدمين
// router.get('/all', async (req, res) => {
//   const users = await require('../models/User').find({}).select('-password');
//   res.json(users);
// });

module.exports = router;
