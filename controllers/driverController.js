// controllers/driverController.js

const Trip = require('../models/Trip');
const CommissionSettings = require('../models/CommissionSettings');

// 📊 لوحة تحكم السائق - جلب بيانات الرحلات والأرباح والخصومات
exports.getDriverDashboard = async (req, res) => {
  try {
    const driverId = req.params.driverId;

    // 🧾 جلب جميع رحلات السائق
    const trips = await Trip.find({ driverId });

    // 🔢 إحصائيات أساسية
    const totalTrips = trips.length;
    const completedTrips = trips.filter(t => t.status === 'completed').length;
    const upcomingTrips = trips.filter(t => t.status === 'scheduled').length;
    const cancelledTrips = trips.filter(t => t.status === 'cancelled').length;

    // 💰 حساب الأرباح والخصومات
    const activeCommission = await CommissionSettings.findOne({ isActive: true });
    const commissionRate = activeCommission ? activeCommission.value : 0;

    let totalEarnings = 0;
    let totalCommission = 0;

    trips.forEach(trip => {
      if (trip.status === 'completed') {
        totalEarnings += trip.fare;
        totalCommission += (trip.fare * commissionRate) / 100;
      }
    });

    // 📋 آخر 5 رحلات
    const recentTrips = trips
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    // 📦 الرد النهائي
    res.json({
      stats: {
        totalTrips,
        completedTrips,
        upcomingTrips,
        cancelledTrips,
        totalEarnings,
        totalCommission,
        netIncome: totalEarnings - totalCommission,
        commissionRate
      },
      recentTrips
    });

  } catch (error) {
    console.error('خطأ في جلب بيانات لوحة السائق:', error);
    res.status(500).json({ message: 'فشل في تحميل لوحة السائق' });
  }
};
