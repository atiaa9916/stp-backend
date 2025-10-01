const express = require('express');
const router = express.Router();
const {
  getCommissionSettings,
  updateCommissionSettings
} = require('../controllers/commissionController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

// ✅ جلب إعدادات العمولة
router.get('/', protect, adminOnly, getCommissionSettings);

// ✅ تعديل إعدادات العمولة
router.put('/', protect, adminOnly, updateCommissionSettings);

module.exports = router;
