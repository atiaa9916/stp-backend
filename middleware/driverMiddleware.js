// middleware/driverMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🛡️ حماية المسارات الخاصة بالسائقين
const protectDriver = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // استخراج التوكن
      token = req.headers.authorization.split(' ')[1];

      // التحقق من صحة التوكن
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // البحث عن السائق في قاعدة البيانات وتأكيد نوعه
      const user = await User.findById(decoded.id);

      if (!user || user.role !== 'driver') {
        return res.status(401).json({ message: 'صلاحية غير كافية' });
      }

      req.user = user; // تمرير المستخدم للطلب
      next();

    } catch (error) {
      console.error('خطأ في التحقق من التوكن:', error);
      res.status(401).json({ message: 'رمز التحقق غير صالح' });
    }
  } else {
    res.status(401).json({ message: 'لم يتم تقديم رمز التحقق' });
  }
};

module.exports = { protectDriver };
