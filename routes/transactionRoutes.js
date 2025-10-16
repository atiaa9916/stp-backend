const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/authMiddleware');
const { getMyTransactions } = require('../controllers/transactionController');

/**
 * 📄 جلب المعاملات المالية للمستخدم الحالي
 * - المنطق كله داخل controller/getMyTransactions
 * - يرجع { value, Count } مع fallback ذكي من Trip لتغطية فجوات البيانات
 */
router.get('/', protect, getMyTransactions);

/**
 * ➕ إنشاء معاملة مالية جديدة (اختياري للاختبار/الأدوات)
 * - يكتب الحقلين user و userId لتوحيد البيانات.
 * - يملأ الحقلين description و desc (توافق خلفي).
 * - يدعم: type ('debit'|'credit'), amount, description, method, relatedTrip
 */
router.post('/', protect, async (req, res) => {
  try {
    const { type, amount, description = '', method = 'wallet', relatedTrip } = req.body;

    const newTransaction = await Transaction.create({
      user: req.user._id,
      userId: req.user._id,
      type,
      amount,
      method,
      description,
      desc: description,
      relatedTrip
    });

    res.status(201).json(newTransaction);
  } catch (error) {
    res.status(500).json({ message: 'فشل إنشاء المعاملة', error: error.message });
  }
});

module.exports = router;
