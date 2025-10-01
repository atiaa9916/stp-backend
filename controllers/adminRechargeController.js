// backend/controllers/adminRechargeController.js

const RechargeCode = require('../models/rechargeCodeModel');
const User = require('../models/User');

// ✅ عرض كل رموز الشحن مع بيانات البائع
exports.getAllRechargeCodesWithVendors = async (req, res) => {
  try {
    const codes = await RechargeCode.find({})
      .populate('vendorId', 'name phone phoneNumber email')
      .sort({ createdAt: -1 });

    res.status(200).json(codes);
  } catch (error) {
    console.error('فشل في جلب رموز الشحن:', error);
    res.status(500).json({ message: 'فشل في جلب رموز الشحن' });
  }
};
