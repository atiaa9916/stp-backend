const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protectAdmin } = require('../middleware/adminMiddleware');

// ✅ GET: عرض سجل المعاملات مع دعم الفلترة
router.get('/', protectAdmin, async (req, res) => {
  try {
    const { userId, type, startDate, endDate } = req.query;

    const filter = {};

    if (userId) {
      filter.userId = userId;
    }

    if (type) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'name phone role'); // عرض بيانات المستخدم المرتبطة

    res.status(200).json(transactions);
  } catch (error) {
    console.error('فشل في جلب المعاملات:', error);
    res.status(500).json({ message: 'فشل في جلب سجل المعاملات' });
  }
});

module.exports = router;
