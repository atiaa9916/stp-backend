// controllers/driverAuthController.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createWalletForUser } = require('./walletController');

// 🟢 تسجيل حساب سائق جديد
const registerDriver = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'رقم الجوال مستخدم بالفعل' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDriver = await User.create({
      name,
      phone,
      password: hashedPassword,
      role: 'driver',
      isActive: true
    });

    await createWalletForUser(newDriver._id);

    const token = jwt.sign({ id: newDriver._id, role: 'driver' }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: newDriver._id,
        name: newDriver.name,
        phone: newDriver.phone,
        role: newDriver.role,
      }
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
    if (!driver) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ id: driver._id, role: 'driver' }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: driver._id,
        phone: driver.phone,
        role: driver.role,
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في تسجيل الدخول', error: error.message });
  }
};

// ✅ التصدير السليم
module.exports = {
  registerDriver,
  loginDriver
};
