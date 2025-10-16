// controllers/userController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { createWalletForUser } = require('./walletController');

// توليد توكن موحّد
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// 🔐 تسجيل مستخدم باستخدام رقم الجوال فقط (يُنشئ Passenger دائمًا)
exports.registerUser = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    // لا تسمح بتحديد الدور من العميل في المسار العام
    const role = 'passenger';

    // تحقق من عدم وجود مستخدم بنفس الرقم
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'المستخدم موجود بالفعل برقم الهاتف' });
    }

    // ❗️ لا تشفّر هنا — الـ Model يقوم بالتشفير تلقائيًا (pre('save'))
    const user = await User.create({ name, phone, password, role });

    // إنشاء محفظة للمستخدم بعد التسجيل
    try { await createWalletForUser(user._id); } catch (_) {}

    res.status(201).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: 'فشل إنشاء الحساب', error: err.message });
  }
};

// 🔐 تسجيل الدخول باستخدام رقم الجوال
exports.loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // نجلب الـ password لأن الحقل select:false غالبًا
    const user = await User.findOne({ phone }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: 'فشل تسجيل الدخول', error: err.message });
  }
};

// 👤 الملف الشخصي (محمي)
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'فشل جلب الملف الشخصي', error: err.message });
  }
};
