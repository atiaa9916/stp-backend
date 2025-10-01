// controllers/vendorController.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createWalletForUser } = require('./walletController');

// ✅ إنشاء توكن JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// 🟢 تسجيل حساب بائع جديد
const registerVendor = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'رقم الجوال مستخدم مسبقًا' });
    }

    const newVendor = await User.create({
      name,
      phone,
      password, // ❗️ بدون تشفير يدوي، لأن pre('save') يقوم بالمهمة
      role: 'vendor',
      isActive: true
    });

    await createWalletForUser(newVendor._id); // إنشاء محفظة تلقائيًا

    const token = generateToken(newVendor._id);

    res.status(201).json({
      message: '✅ تم إنشاء حساب البائع بنجاح',
      token,
      user: {
        id: newVendor._id,
        name: newVendor.name,
        phone: newVendor.phone,
        role: newVendor.role,
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'فشل في تسجيل البائع', error: error.message });
  }
};

// 🔐 تسجيل دخول البائع
const loginVendor = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone, role: 'vendor' }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: '✅ تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'فشل في تسجيل الدخول', error: error.message });
  }
};

// 📊 لوحة تحكم البائع
const getVendorDashboard = async (req, res) => {
  try {
    res.status(200).json({
      message: `📦 مرحبًا بك يا ${req.user.name} في لوحة تحكم البائع`,
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

module.exports = {
  registerVendor,
  loginVendor,
  getVendorDashboard
};