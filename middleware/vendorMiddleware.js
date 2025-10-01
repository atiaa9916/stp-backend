// middleware/vendorMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🔐 حماية مسارات البائع
const protectVendor = async (req, res, next) => {
  let token;

  // التحقق من وجود التوكن في الهيدر
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // استخراج التوكن
      token = req.headers.authorization.split(' ')[1];

      // التحقق من التوكن
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // جلب المستخدم من القاعدة
      const user = await User.findById(decoded.id);

      if (!user || user.role !== 'vendor') {
        return res.status(401).json({ message: 'غير مصرح لك كبائع' });
      }

      // إرفاق بيانات المستخدم بالطلب
      req.user = user;
      next();

    } catch (error) {
      return res.status(401).json({ message: 'توكن غير صالح' });
    }
  } else {
    res.status(401).json({ message: 'لا يوجد توكن، الوصول مرفوض' });
  }
};

module.exports = { protectVendor };
