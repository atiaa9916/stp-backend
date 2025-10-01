// backend/routes/rentalRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/rentalController');

// إنشاء عرض سعر موقّع
router.post('/quote', protect, ctrl.quote);

// تأكيد الدفع/الضمان (Escrow)
router.post('/confirm-payment', protect, ctrl.confirmPayment);

// جدولة التسليم
router.post('/schedule-handover', protect, ctrl.scheduleHandover);

module.exports = router;
