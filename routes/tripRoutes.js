// routes/tripRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createTrip, getTripsByUser, updateTripStatus, cancelTrip, getTripsByFilter } = require('../controllers/tripController');

// 🟢 إنشاء رحلة جديدة
router.post('/', protect, createTrip);

// 📄 رحلات المستخدم الحالي
router.get('/my-trips', protect, getTripsByUser);

// 🔎 التصفية العامة
router.get('/filter', protect, getTripsByFilter);

// 🟡 تحديث حالة رحلة (يدعم body:{status:'...'})
router.patch('/:id/status', protect, updateTripStatus);
router.post('/:id/status',  protect, updateTripStatus); // دعم POST أيضًا

// إلغاء مختصر
router.post('/:id/cancel',  protect, cancelTrip);
router.patch('/:id/cancel', protect, cancelTrip);

module.exports = router;