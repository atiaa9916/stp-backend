//controllers/authController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { createWalletForUser } = require('./walletController');

// إنشاء توكن JWT موحّد
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ✅ تسجيل مستخدم جديد (عام) — يفرض role='passenger'
exports.registerUser = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    const exists = await User.findOne({ phone });
    if (exists) {
      return res.status(400).json({ message: 'المستخدم موجود مسبقًا' });
    }

    // تجاهل أي role قادم من العميل
    const newUser = await User.create({ name, phone, password, role: 'passenger' });

    // إنشاء محفظة بعد التسجيل مباشرة (غير حرج إن فشل)
    try { await createWalletForUser(newUser._id); } catch (_) {}

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      phone: newUser.phone,
      role: newUser.role,
      token: generateToken(newUser._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'فشل إنشاء الحساب', error: error.message });
  }
};

// ✅ تسجيل الدخول (عام)
exports.loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // انتبه لإضافة +password لأن الحقل غالبًا select:false
    const user = await User.findOne({ phone }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'فشل تسجيل الدخول', error: error.message });
  }
};
