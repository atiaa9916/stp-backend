// routes/adminAuthRoutes.js
const express = require('express');
const router = express.Router();
const { loginAdmin, registerAdmin } = require('../controllers/adminAuthController');

// حارس مفتاح التسجيل الإداري (اختياري)
const adminRegisterGuard = (req, res, next) => {
  const key = req.headers['x-admin-secret'] || req.query.admin_key;
  const expected = process.env.ADMIN_REGISTER_SECRET;
  if (!expected) return res.status(500).json({ message: 'ADMIN_REGISTER_SECRET غير معرّف في .env' });
  if (key !== expected) return res.status(403).json({ message: 'غير مصرح' });
  next();
};

// 📌 تسجيل دخول المسؤولين
router.post('/login', loginAdmin);

// ✅ تسجيل مسؤول رسمي (محمي بمفتاح سري)
router.post('/register', adminRegisterGuard, registerAdmin);

module.exports = router;
