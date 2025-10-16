// backend/routes/adminRechargeRoutes.js

const express = require('express');
const router = express.Router();
const protectAdmin = require('../middleware/adminMiddleware');

const {
  getAllRechargeCodesWithVendors,   // عرض مع فلاتر
} = require('../controllers/adminRechargeController');

const {
  revertRechargeCodeByAdmin,        // إلغاء الاستخدام + تعطيل + معاملة عكسية + AuditLog
  deleteRechargeCodeByAdmin,        // حذف نهائي (إن لم يكن مستخدمًا)
} = require('../controllers/adminController');

/**
 * ✅ عرض جميع رموز الشحن مع فلاتر اختيارية:
 *   ?isUsed=true|false
 *   ?isDisabled=true|false
 *   ?vendorId=<ObjectId>
 *   ?code=<partial>
 */
router.get('/all', protectAdmin, getAllRechargeCodesWithVendors);

/** ✅ إلغاء استخدام رمز (Admin) */
router.post('/:codeId/revert', protectAdmin, revertRechargeCodeByAdmin);

/** ✅ حذف رمز نهائيًا (Admin) */
router.delete('/:codeId', protectAdmin, deleteRechargeCodeByAdmin);

module.exports = router;
