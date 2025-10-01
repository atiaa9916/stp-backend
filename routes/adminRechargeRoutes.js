// backend/routes/adminRechargeRoutes.js

const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminMiddleware');
const { getAllRechargeCodesWithVendors } = require('../controllers/adminRechargeController');

// ✅ عرض جميع الرموز مع بيانات البائع
router.get('/all', protectAdmin, getAllRechargeCodesWithVendors);

module.exports = router;