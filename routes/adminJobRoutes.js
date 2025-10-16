// routes/adminRoutes.js أو ملف جديد adminJobRoutes.js
const express = require('express');
const router = express.Router();
const protectAdmin = require('../middleware/adminMiddleware');
const processScheduledTrips = require('../utils/scheduledTripProcessor');

router.post('/run-scheduled-trips', protectAdmin, async (req, res) => {
  try {
    await processScheduledTrips();
    res.status(200).json({ message: '✅ تمت معالجة الرحلات المجدولة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: '❌ حدث خطأ أثناء المعالجة', details: err.message });
  }
});

module.exports = router;