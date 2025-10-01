const Transaction = require('../models/Transaction');

// 📄 جلب سجل المعاملات لمستخدم معيّن
exports.getMyTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'فشل في جلب المعاملات', error: error.message });
  }
};
