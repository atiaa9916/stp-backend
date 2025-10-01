const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { createWalletForUser } = require('./walletController'); // ✅ إضافة الاستدعاء

// إنشاء توكن JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// ✅ تسجيل مستخدم جديد
exports.registerUser = async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;

    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'المستخدم موجود مسبقًا' });
    }

    const newUser = await User.create({ name, phone, password, role });

    // ✅ إنشاء محفظة بعد التسجيل مباشرة
    await createWalletForUser(newUser._id);

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

// ✅ تسجيل الدخول
exports.loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

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
