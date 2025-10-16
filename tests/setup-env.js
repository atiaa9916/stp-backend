process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.RUN_JOBS = 'false';

// سياسة الدفع/العمولة في الاختبار
process.env.PRECHARGE_WALLET = 'false';
process.env.COMMISSION_MODEL = 'percent';
process.env.COMMISSION_PERCENT = '10';
process.env.CASH_COMMISSION_APPLIES = 'false';
process.env.COMMISSION_CHARGE_STAGE = 'completed';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

// النماذج
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const CommissionSettings = require('../models/CommissionSettings');

global.__TEST_CTX__ = { tokens: {}, ids: {} };

let replset;

// 👇 كتم تحذيرات ECONNRESET التي تظهر عند الإيقاف فقط أثناء طور الاختبار
let _restoreWarn = null;
beforeAll(async () => {
  const origWarn = console.warn;
  console.warn = (...args) => {
    // تجاهل ECONNRESET من mongodb-memory-server أثناء الإيقاف
    if (args && args[0] && String(args[0]).includes('ECONNRESET')) return;
    return origWarn(...args);
  };
  _restoreWarn = () => { console.warn = origWarn; };

  // Replica Set داخل الذاكرة (للمعاملات)
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  const uri = replset.getUri();
  await mongoose.connect(uri, { dbName: 'stp_test' });

  // عمولة افتراضية فعّالة
  await CommissionSettings.create({
    type: 'fixedPercentage',
    value: 10,
    applies: { wallet: true, cash: false },
    chargeStage: 'completed',
    isActive: true,
    note: 'Test 10% wallet-only'
  });

  // مستخدمين (مع كلمة مرور لتوافق السكيمة)
  const [admin, driver, passenger, vendor] = await Promise.all([
    User.create({ name: 'Admin',     phone: '0900000000', role: 'admin',     password: 'secret123' }),
    User.create({ name: 'Driver',    phone: '0900000001', role: 'driver',    password: 'secret123' }),
    User.create({ name: 'Passenger', phone: '0900000002', role: 'passenger', password: 'secret123' }),
    User.create({ name: 'Vendor',    phone: '0900000003', role: 'vendor',    password: 'secret123' }),
  ]);

  global.__TEST_CTX__.ids = {
    admin: admin._id.toString(),
    driver: driver._id.toString(),
    passenger: passenger._id.toString(),
    vendor: vendor._id.toString(),
  };

  // محافظ
  await Promise.all([
    Wallet.create({ user: passenger._id, balance: 10000 }),
    Wallet.create({ user: driver._id,    balance: 5000 }),
    Wallet.create({ user: vendor._id,    balance: 0 }),
  ]);

  // توكنات بنفس الـ payload الذي تتحقق منه middleware (decoded._id/decoded.role)
  const sign = (u) => jwt.sign(
    { _id: u._id.toString(), role: u.role, isAdmin: u.role === 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  global.__TEST_CTX__.tokens = {
    admin: sign(admin),
    driver: sign(driver),
    passenger: sign(passenger),
    vendor: sign(vendor),
  };

  // نحمل التطبيق بدون تشغيل السيرفر
  global.__APP__ = require('../app');
});

afterAll(async () => {
  try { await mongoose.connection.close(); } catch (_) {}
  try { if (replset) await replset.stop(); } catch (_) {}
  // استرجاع console.warn الأصلي
  if (_restoreWarn) { try { _restoreWarn(); } catch (_) {} }
});
