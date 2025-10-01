const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🔐 Middleware لحماية المسارات
const protect = async (req, res, next) => {
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

      // جلب بيانات المستخدم من قاعدة البيانات بدون كلمة المرور
      req.user = await User.findById(decoded.id).select('_id role phone');

      next(); // السماح بالمتابعة
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'فشل التحقق من التوكن' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'لا يوجد توكن، الوصول مرفوض' });
  }
};

// ✅ التحقق من أن المستخدم هو مدير
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'غير مصرح - للمسؤولين فقط' });
  }
};

module.exports = {
  protect,
  adminOnly // ← تأكد أن هذه مُصدرة
};