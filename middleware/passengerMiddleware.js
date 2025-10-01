// middleware/passengerMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🔐 حماية مسارات الركاب
exports.protectPassenger = async (req, res, next) => {
  let token;

  // ✅ استخراج التوكن من الهيدر
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id);

      if (!user || user.role !== 'passenger') {
        return res.status(403).json({ message: '🚫 الوصول مرفوض - غير مصرح للركاب' });
      }

      req.user = user; // ✅ تمرير بيانات المستخدم
      next();
    } catch (error) {
      return res.status(401).json({ message: '❌ توكن غير صالح أو منتهي' });
    }
  } else {
    return res.status(401).json({ message: '🔐 لا يوجد توكن مصرح' });
  }
};
