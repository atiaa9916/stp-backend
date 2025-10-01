// routes/rechargeRoutes.js
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { protectVendor } = require('../middleware/vendorMiddleware');

const {
  createRechargeCodesBatch,
  createRechargeCode,
  useRechargeCode,
  getMyRechargeCodes,
  getRechargeCodeQR,
  deleteRechargeCode,
  getVendorRechargeStats,
  getRechargeUsageByVendor,
  getUnusedRechargeCodesByVendor,
  getRechargeTransactionsByVendor,   // ✅ استيراد مرة واحدة فقط
  disableRechargeCode,
} = require('../controllers/rechargeCodeController');

/* ─────────────────────────────────────────────────────────
   ✅ مسارات البائع (محميّة بـ protectVendor)
───────────────────────────────────────────────────────── */

// إنشاء دفعة من رموز الشحن
router.post('/create', protectVendor, createRechargeCodesBatch);

// إنشاء رمز واحد (اختياري)
router.post('/create-one', protectVendor, createRechargeCode);

// إحصائيات البائع
router.get('/stats', protectVendor, getVendorRechargeStats);

// سجل الرموز المستخدمة
router.get('/used-by-vendor', protectVendor, getRechargeUsageByVendor);

// الرموز غير المستخدمة
router.get('/unused-by-vendor', protectVendor, getUnusedRechargeCodesByVendor);

// جميع رموز البائع
router.get('/my-codes', protectVendor, getMyRechargeCodes);

// توليد QR
router.get('/qr/:code', protectVendor, getRechargeCodeQR);

// تعطيل/حذف (تعطيل فعليًا)
router.patch('/disable/:code', protectVendor, disableRechargeCode);
router.delete('/:code', protectVendor, deleteRechargeCode);

// ✅ معاملات البائع عبر أكواد الشحن (الواجهة تستدعي هذا)
router.get('/vendor-transactions', protectVendor, getRechargeTransactionsByVendor);

// (اختياري) توافق للخلف — نفس الدالة على /transactions
router.get('/transactions', protectVendor, getRechargeTransactionsByVendor);

/* ─────────────────────────────────────────────────────────
   ✅ مسارات عامة للمستخدم (راكب/سائق)
───────────────────────────────────────────────────────── */

// استخدام رمز الشحن
router.post('/use', protect, useRechargeCode);

module.exports = router;
