const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createWalletForUser } = require('./walletController'); // ✅ لإنشاء محفظة تلقائيًا

// 🔐 إنشاء توكن
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// 🟢 تسجيل حساب راكب جديد
const registerPassenger = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'رقم الجوال مستخدم مسبقًا' });
    }

    // ⛔️ لا نقوم بالتشفير يدويًا هنا
    const newPassenger = await User.create({
      name,
      phone,
      password, // ❗ سيتم تشفيره تلقائيًا في model
      role: 'passenger',
      isActive: true
    });

    await createWalletForUser(newPassenger._id); // ✅ إنشاء محفظة تلقائيًا

    const token = generateToken(newPassenger._id);

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: newPassenger._id,
        name: newPassenger.name,
        phone: newPassenger.phone,
        role: newPassenger.role,
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'فشل تسجيل الحساب', error: error.message });
  }
};

// 🔐 تسجيل دخول الراكب
const loginPassenger = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone, role: 'passenger' }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'فشل تسجيل الدخول', error: error.message });
  }
};

// 📊 لوحة تحكم الراكب
const getPassengerDashboard = async (req, res) => {
  try {
    res.status(200).json({
      message: `🎉 مرحبًا بك يا ${req.user.name} في لوحة تحكم الراكب`,
      user: {
        id: req.user._id,
        name: req.user.name,
        phone: req.user.phone,
        role: req.user.role,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'فشل عرض لوحة التحكم', error: error.message });
  }
};

// 👤 جلب بيانات الراكب (محمي)
const getPassengerProfile = async (req, res) => {
  try {
    res.status(200).json({
      id: req.user._id,
      name: req.user.name,
      phone: req.user.phone,
      role: req.user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'فشل جلب البيانات', error: error.message });
  }
};

module.exports = {
  registerPassenger,
  loginPassenger,
  getPassengerDashboard,
  getPassengerProfile
};