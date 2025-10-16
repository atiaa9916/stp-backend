// controllers/driverAuthController.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createWalletForUser } = require('./walletController');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// 🟢 تسجيل حساب سائق جديد
const registerDriver = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: 'رقم الجوال مستخدم بالفعل' });
    }

    // ❗️ لا تشفّر هنا — الـ Model يتكفل بالتشفير
    const driver = await User.create({
      name,
      phone,
      password,
      role: 'driver',
      isActive: true,
    });

    try { await createWalletForUser(driver._id); } catch (_) {}

    res.status(201).json({
      _id: driver._id,
      name: driver.name,
      phone: driver.phone,
      role: driver.role,
      token: generateToken(driver._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'فشل في تسجيل الحساب', error: error.message });
  }
};

// 🔐 تسجيل دخول السائق
const loginDriver = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const driver = await User.findOne({ phone, role: 'driver' }).select('+password');
    if (!driver || !(await driver.matchPassword(password))) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    res.json({
      _id: driver._id,
      name: driver.name,
      phone: driver.phone,
      role: driver.role,
      token: generateToken(driver._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في تسجيل الدخول', error: error.message });
  }
};

module.exports = { registerDriver, loginDriver };
