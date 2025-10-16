const express = require('express');
const router = express.Router();
const CommissionSettings = require('../models/CommissionSettings');
const protectAdmin = require('../middleware/adminMiddleware');

// ✅ إضافة إعداد عمولة جديد
router.post('/', protectAdmin, async (req, res) => {
  try {
    const { type, value, note } = req.body;

    const newSetting = new CommissionSettings({
      type,
      value,
      note,
      isActive: false // يتم التفعيل يدويًا
    });

    await newSetting.save();
    res.status(201).json({ message: 'تمت إضافة الإعداد بنجاح', data: newSetting });
  } catch (error) {
    console.error('خطأ أثناء إنشاء إعداد العمولة:', error);
    res.status(500).json({ message: 'فشل إنشاء إعداد العمولة' });
  }
});

// ✅ عرض الإعداد الحالي المفعل فقط
router.get('/active', protectAdmin, async (req, res) => {
  try {
    const activeSetting = await CommissionSettings.findOne({ isActive: true });
    if (!activeSetting) {
      return res.status(404).json({ message: 'لا يوجد إعداد مفعل حالياً' });
    }
    res.json(activeSetting);
  } catch (error) {
    console.error('خطأ أثناء جلب الإعداد المفعل:', error);
    res.status(500).json({ message: 'فشل في جلب الإعداد المفعل' });
  }
});

// ✅ تفعيل إعداد معين وتعطيل الباقي
router.patch('/activate/:id', protectAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // إلغاء تفعيل كل الإعدادات الأخرى
    await CommissionSettings.updateMany({}, { $set: { isActive: false } });

    // تفعيل الإعداد المطلوب
    const updated = await CommissionSettings.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'الإعداد غير موجود' });
    }

    res.json({ message: 'تم تفعيل الإعداد بنجاح', data: updated });
  } catch (error) {
    console.error('خطأ أثناء تفعيل الإعداد:', error);
    res.status(500).json({ message: 'فشل تفعيل الإعداد' });
  }
});

module.exports = router;
