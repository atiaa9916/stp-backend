const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protectAdmin } = require('../middleware/adminMiddleware');

// ✅ عرض جميع المستخدمين مع إمكانية الفلترة حسب الدور
router.get('/', protectAdmin, async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) {
      filter.role = role;
    }
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('فشل في جلب المستخدمين:', error);
    res.status(500).json({ message: 'فشل في جلب المستخدمين' });
  }
});

// ✅ تعديل بيانات مستخدم
router.patch('/:id', protectAdmin, async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json({ message: 'تم تعديل المستخدم بنجاح', data: updatedUser });
  } catch (error) {
    console.error('خطأ في التعديل:', error);
    res.status(500).json({ message: 'فشل تعديل بيانات المستخدم' });
  }
});

// ✅ تعطيل أو تفعيل مستخدم
router.patch('/toggle/:id', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({ message: `تم ${user.isActive ? 'تفعيل' : 'تعطيل'} المستخدم`, data: user });
  } catch (error) {
    console.error('خطأ أثناء التفعيل/التعطيل:', error);
    res.status(500).json({ message: 'فشل تنفيذ الطلب' });
  }
});

// ✅ حذف مستخدم نهائيًا
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'المستخدم غير موجود' });
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    console.error('خطأ في الحذف:', error);
    res.status(500).json({ message: 'فشل حذف المستخدم' });
  }
});

module.exports = router;
