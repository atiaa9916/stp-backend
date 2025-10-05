// routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const {
  getMyBalance,
  chargeBalance,
  transferBalance,   // موجود لديك
  getStatement,      // ✅ أضف هذا السطر
} = require('../controllers/walletController');

// 📄 جلب الرصيد
router.get('/balance', protect, getMyBalance);
router.get('/balance2', protect, getMyBalance);

// alias توافقية:
router.get('/me', protect, getMyBalance); // يدعم /api/wallet/me

// ➕ شحن الرصيد
router.post('/charge', protect, chargeBalance);

// 🔁 تحويل الرصيد إلى مستخدم آخر
router.post('/transfer', protect, transferBalance);

// 🧾 كشف العمليات (Statement)
router.get('/statement', protect, getStatement); // ✅ أضف هذا السطر

module.exports = router;
