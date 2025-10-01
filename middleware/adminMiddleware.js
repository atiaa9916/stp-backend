const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🔒 حماية مسارات المسؤولين فقط
const protectAdmin = async (req, res, next) => {
  let token;

  // 🟡 التحقق من وجود التوكن في الهيدر
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // استخراج التوكن من الهيدر
      token = req.headers.authorization.split(' ')[1];

      // فك تشفير التوكن
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // جلب المستخدم بناءً على ID
      const user = await User.findById(decoded.id);

      // التحقق من وجود المستخدم وصلاحياته
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'غير مصرح - دخول المسؤول فقط' });
      }

      // إضافة المستخدم إلى الطلب للخطوات التالية
      req.user = user;
      next();

    } catch (error) {
      console.error('خطأ التوكن الإداري:', error);
      return res.status(401).json({ message: 'فشل في التحقق من التوكن' });
    }
  } else {
    return res.status(401).json({ message: 'لا يوجد توكن مصرح' });
  }
};

module.exports = { protectAdmin };
