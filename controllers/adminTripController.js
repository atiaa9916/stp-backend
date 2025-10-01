// controllers/adminTripController.js
const Trip = require('../models/Trip');

// ✅ عرض الرحلات المجدولة التي تم تنفيذها
exports.getExecutedScheduledTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ isScheduled: true, status: 'ready' })
      .populate('driver', 'name phone')
      .populate('passenger', 'name phone')
      .sort({ scheduledDateTime: -1 });

    res.status(200).json(trips);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء جلب البيانات', details: err.message });
  }
};