//controllers/passengerController.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createWalletForUser } = require('./walletController'); // لإنشاء محفظة تلقائيًا

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// 🟢 تسجيل حساب راكب جديد
const registerPassenger = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: 'رقم الجوال مستخدم مسبقًا' });
    }

    // ❗️ لا تشفّر يدويًا — Model يقوم بالتشفير
    const passenger = await User.create({
      name,
      phone,
      password,
      role: 'passenger',
      isActive: true,
    });

    try { await createWalletForUser(passenger._id); } catch (_) {}

    res.status(201).json({
      _id: passenger._id,
      name: passenger.name,
      phone: passenger.phone,
      role: passenger.role,
      token: generateToken(passenger._id),
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
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
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
      },
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
  getPassengerProfile,
};
