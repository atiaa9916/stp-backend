// routes/adminDashboardRoutes.js
const express = require('express');
const router = express.Router();

// كنترولرات الإدارة (بدون وظائف الشحن/العمولة هنا لتفادي الازدواج)
const {
  // معاملات وسجلات
  getAllTransactions,
  getAcceptanceLogs,

  // المستخدمون + الإحصائيات
  getAllUsersWithWallets,
  toggleUserActivation,
  deleteUser,
  getAdminDashboardStats,
} = require('../controllers/adminController');

const { getExecutedScheduledTrips } = require('../controllers/adminTripController');

// ✅ حارس المسؤول الموحد
const protectAdmin = require('../middleware/adminMiddleware');

// ======================= المعاملات والسجلات =======================
router.get('/transactions',        protectAdmin, getAllTransactions);
router.get('/acceptance-logs',     protectAdmin, getAcceptanceLogs);

// ======================= الرحلات المجدولة =======================
router.get('/executed-scheduled-trips', protectAdmin, getExecutedScheduledTrips);

// ======================= إدارة المستخدمين =======================
router.get('/users',                         protectAdmin, getAllUsersWithWallets);
router.patch('/users/:id/toggle-activation', protectAdmin, toggleUserActivation);
router.delete('/users/:id',                  protectAdmin, deleteUser);

// ======================= الإحصائيات =======================
router.get('/dashboard/stats', protectAdmin, getAdminDashboardStats);

module.exports = router;
