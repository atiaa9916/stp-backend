// controllers/adminAuthController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// توليد JWT
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// Helpers: توحيد الهاتف بإبقاء الأرقام فقط
const normalizePhone = (p = '') => (p + '').replace(/\D/g, '').trim();
// السماح بما يتوافق مع الـ schema (9–15 أرقام)
const isValidPhone = (p) => /^\d{9,15}$/.test(p);

// ✅ تسجيل مسؤول جديد (يتطلب ADMIN_SECRET_KEY)
exports.registerAdmin = async (req, res) => {
  try {
    const { name, phone, password, secretKey } = req.body || {};

    if (!name || !phone || !password || !secretKey) {
      return res.status(400).json({ message: 'البيانات غير كاملة' });
    }
    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: 'مفتاح التسجيل غير صحيح' });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ message: 'رقم الهاتف يجب أن يكون أرقامًا فقط من 9 إلى 15 خانة' });
    }

    const exists = await User.findOne({ phone: normalizedPhone });
    if (exists) {
      return res.status(409).json({ message: 'يوجد مستخدم بهذا الرقم' });
    }

    // التشفير يتم في pre('save')
    const admin = await User.create({
      name: name.trim(),
      phone: normalizedPhone,
      password,
      role: 'admin',
      isActive: true,
    });

    return res.status(201).json({
      message: 'تم تسجيل المسؤول بنجاح',
      _id: admin._id,
      name: admin.name,
      phone: admin.phone,
      role: admin.role,
      token: generateToken(admin._id),
    });
  } catch (error) {
    console.error('registerAdmin error:', error);
    return res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
};

// 🔐 تسجيل دخول المسؤول
exports.loginAdmin = async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const normalizedPhone = normalizePhone(phone);

    const user = await User.findOne({ phone: normalizedPhone }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'غير مصرح - المستخدم غير موجود' });
    }
    if (user.role !== 'admin') {
      return res.status(401).json({ message: 'غير مصرح - حساب غير إداري' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: 'الحساب معطل، راجع الإدارة' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
    }

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('loginAdmin error:', error);
    return res.status(500).json({ message: 'حدث خطأ في تسجيل الدخول', error: error.message });
  }
};
