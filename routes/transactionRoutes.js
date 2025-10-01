const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/authMiddleware');

// 📄 جلب المعاملات المالية للمستخدم الحالي
router.get('/', protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('relatedTrip', '_id'); // إظهار رقم الرحلة فقط

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'فشل جلب سجل المعاملات', error: error.message });
  }
});

// ➕ إنشاء معاملة مالية جديدة
router.post('/', protect, async (req, res) => {
  try {
    const { type, amount, description, relatedTrip } = req.body;

    const newTransaction = await Transaction.create({
      user: req.user._id,
      type,
      amount,
      description,
      relatedTrip
    });

    res.status(201).json(newTransaction);
  } catch (error) {
    res.status(500).json({ message: 'فشل إنشاء المعاملة', error: error.message });
  }
});

module.exports = router;
