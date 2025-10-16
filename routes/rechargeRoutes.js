// routes/rechargeRoutes.js
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
// ✅ حارس البائع الموحّد (تأكد أنه default export مثل adminMiddleware)
const protectVendor = require('../middleware/vendorMiddleware');

const {
  // Vendor ops
  createRechargeCodesBatch,
  createRechargeCode,
  getVendorRechargeStats,
  getRechargeUsageByVendor,
  getUnusedRechargeCodesByVendor,
  getMyRechargeCodes,
  getRechargeCodeQR,
  disableRechargeCode,
  deleteRechargeCode,
  getRechargeTransactionsByVendor, // 👈 مسار معاملات البائع
  // Public ops
  useRechargeCode,
} = require('../controllers/rechargeCodeController');

/* ─────────────────────────────────────────────────────────
   ✅ مسارات البائع (محميّة بـ protectVendor)
───────────────────────────────────────────────────────── */

// إنشاء دفعة من رموز الشحن
router.post('/create', protectVendor, createRechargeCodesBatch);

// إنشاء رمز واحد
router.post('/create-one', protectVendor, createRechargeCode);

// إحصائيات البائع
router.get('/stats', protectVendor, getVendorRechargeStats);

// سجل الرموز المستخدمة
router.get('/used-by-vendor', protectVendor, getRechargeUsageByVendor);

// الرموز غير المستخدمة
router.get('/unused-by-vendor', protectVendor, getUnusedRechargeCodesByVendor);

// جميع رموز البائع
router.get('/my-codes', protectVendor, getMyRechargeCodes);

// توليد QR لرمز معيّن
router.get('/qr/:code', protectVendor, getRechargeCodeQR);

// تعطيل/حذف رمز (الحذف هنا يعني تعطيل)
router.patch('/disable/:code', protectVendor, disableRechargeCode);
router.delete('/:code', protectVendor, deleteRechargeCode);

// معاملات الشحن الناتجة عن أكواد هذا البائع
router.get('/vendor-transactions', protectVendor, getRechargeTransactionsByVendor);

// توافق للخلف: نفس النتيجة على /transactions
router.get('/transactions', protectVendor, getRechargeTransactionsByVendor);

/* ─────────────────────────────────────────────────────────
   ✅ مسارات عامة (راكب/سائق)
───────────────────────────────────────────────────────── */

// استخدام رمز الشحن
router.post('/use', protect, useRechargeCode);

module.exports = router;
