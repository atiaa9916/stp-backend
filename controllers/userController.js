const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// توليد توكن
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// 🔐 تسجيل مستخدم باستخدام رقم الجوال فقط
exports.registerUser = async (req, res) => {
  const { name, phone, password, role } = req.body;

  // ✅ تحقق من أن المستخدم النشط غير موجود بنفس رقم الهاتف
  const userExists = await User.findOne({ phone, isActive: true });
  if (userExists) {
    return res.status(400).json({ message: 'المستخدم موجود بالفعل برقم الهاتف' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    phone,
    password: hashedPassword,
    role: role || 'passenger'
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    token: generateToken(user._id)
  });
};

// 🔐 تسجيل الدخول باستخدام رقم الجوال
exports.loginUser = async (req, res) => {
  const { phone, password } = req.body;

  const user = await User.findOne({ phone, isActive: true }).select('+password');
  if (!user) {
    return res.status(400).json({ message: 'رقم الجوال غير صحيح' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'كلمة المرور غير صحيحة' });
  }

  res.json({
    _id: user._id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    token: generateToken(user._id)
  });
};

// 👤 الملف الشخصي (اختياري)
exports.getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json(user);
};
