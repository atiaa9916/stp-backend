// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * تحصين عام:
 * - يدعم id أو _id أو userId من الـ JWT
 * - يتحقق من isActive
 * - يستبعد كلمة المرور من الاستعلام
 */
const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'لا يوجد توكن، الوصول مرفوض' });
    }

    const token = auth.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id || decoded._id || decoded.userId;
    if (!userId) return res.status(401).json({ message: 'توكن غير صالح' });

    const user = await User.findById(userId).select('-password');
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'فشل التحقق من التوكن' });
    }

    // إبقاء علم isAdmin إن وُجد في التوكن (لا يؤثر على الدور المخزن)
    if (typeof decoded.isAdmin === 'boolean') {
      user.isAdmin = decoded.isAdmin;
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'فشل التحقق من التوكن' });
  }
};

// حارس أدوار عام
const roleGuard = (...allowed) => (req, res, next) => {
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'غير مصرح' });
  }
  next();
};

// مشتقات جاهزة
const protectPassenger = [protect, roleGuard('passenger')];
const protectDriver    = [protect, roleGuard('driver')];
const protectVendor    = [protect, roleGuard('vendor')];
const protectAdmin     = [protect, roleGuard('admin')];

module.exports = {
  protect,
  roleGuard,
  protectPassenger,
  protectDriver,
  protectVendor,
  protectAdmin,
};
