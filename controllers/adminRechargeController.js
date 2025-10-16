// backend/controllers/adminRechargeController.js

const RechargeCode = require('../models/rechargeCodeModel');

/**
 * GET /api/admin/recharge/all
 * يدعم فلاتر:
 *   - isUsed: true/false
 *   - isDisabled: true/false
 *   - vendorId: ObjectId
 *   - code: بحث جزئي (regex)
 */
exports.getAllRechargeCodesWithVendors = async (req, res) => {
  try {
    const { isUsed, isDisabled, vendorId, code } = req.query;

    const filter = {};
    if (typeof isUsed !== 'undefined')    filter.isUsed = isUsed === 'true';
    if (typeof isDisabled !== 'undefined') filter.isDisabled = isDisabled === 'true';
    if (vendorId)                          filter.vendorId = vendorId;
    if (code && code.trim())               filter.code = { $regex: code.trim(), $options: 'i' };

    const codes = await RechargeCode.find(filter)
      .populate('vendorId', 'name phone email role') // استخدم "phone" بدل "phoneNumber"
      .populate('usedBy',   'name phone')            // مفيد لعرض المستخدم الذي استخدم الرمز
      .sort({ createdAt: -1 });

    res.status(200).json(codes);
  } catch (error) {
    console.error('فشل في جلب رموز الشحن:', error);
    res.status(500).json({ message: 'فشل في جلب رموز الشحن' });
  }
};
