// routes/adminDashboardRoutes.js
const express = require('express');
const router = express.Router();

const {
  // معاملات وسجلات
  getAllTransactions,
  getAcceptanceLogs,

  // رموز الشحن
  getAllRechargeCodes,
  revertRechargeCodeByAdmin,   // ✅ تمت إضافتها من (1)
  deleteRechargeCodeByAdmin,   // 🗑️ حذف نهائي لرمز معطّل فقط (وممنوع إن كان مستخدمًا)

  // المستخدمون + الإحصائيات
  getAllUsersWithWallets,
  toggleUserActivation,
  deleteUser,
  getAdminDashboardStats,
} = require('../controllers/adminController');

const {
  getExecutedScheduledTrips,
} = require('../controllers/adminTripController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

// ======================= المعاملات والسجلات =======================
router.get('/transactions', protect, adminOnly, getAllTransactions);
router.get('/acceptance-logs', protect, adminOnly, getAcceptanceLogs);

// ======================= رموز الشحن (Admin) =======================
// عرض جميع رموز الشحن
router.get('/recharge/all', protect, adminOnly, getAllRechargeCodes);

// إلغاء استخدام رمز (يعيده غير مستخدم ويضعه معطّلاً)
router.post('/recharge/:codeId/revert', protect, adminOnly, revertRechargeCodeByAdmin);

// حذف نهائي لرمز (مسموح فقط إن كان معطّلاً وغير مستخدم)
router.delete('/recharge/:codeId', protect, adminOnly, deleteRechargeCodeByAdmin);

// ======================= الرحلات المجدولة =======================
router.get('/executed-scheduled-trips', protect, adminOnly, getExecutedScheduledTrips);

// ======================= إدارة المستخدمين =======================
// جلب كل المستخدمين (مع فلاتر الدور/الحالة + أرصدة المحافظ)
router.get('/users', protect, adminOnly, getAllUsersWithWallets);

// تفعيل/تعطيل مستخدم
router.patch('/users/:id/toggle-activation', protect, adminOnly, toggleUserActivation);

// حذف مستخدم نهائيًا
router.delete('/users/:id', protect, adminOnly, deleteUser);

// ======================= الإحصائيات =======================
router.get('/dashboard/stats', protect, adminOnly, getAdminDashboardStats);

module.exports = router;
