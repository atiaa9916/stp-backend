// routes/commissionRoutes.js
const express = require('express');
const router = express.Router();

const { getCommissionSettings, updateCommissionSettings } = require('../controllers/commissionController');
const protectAdmin = require('../middleware/adminMiddleware');

// ✅ جلب إعدادات العمولة
// افتراضيًا يعيد النشِط؛ مرّر ?scope=latest لإرجاع أحدث إعداد محفوظ حتى لو لم يكن نشِطًا
router.get('/', protectAdmin, getCommissionSettings);

// ✅ تعديل/إنشاء إعداد العمولة (singleton نشِط واحد)
router.put('/', protectAdmin, updateCommissionSettings);

module.exports = router;
