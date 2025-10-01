// server.js
const express  = require('express');
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

dotenv.config();

// ✅ تحقّق من وجود رابط الاتصال
if (!process.env.MONGO_URI) {
  console.error('❌ خطأ: لم يتم العثور على MONGO_URI في ملف البيئة .env');
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 5000;

// ========== Middleware عام ==========
app.use(express.json());

// CORS من .env (مثال: CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000)
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true
}));

// تعطيل ETag ومنع الكاش لطلبات الـ API
app.set('etag', false);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ========== ملفات ثابتة ==========
const uploadsDir = path.join(__dirname, 'uploads', 'shamcash');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== استيراد المسارات ==========
const authRoutes             = require('./routes/authRoutes');
const tripRoutes             = require('./routes/tripRoutes');
const walletRoutes           = require('./routes/walletRoutes');
const transactionRoutes      = require('./routes/transactionRoutes');
const rechargeRoutes         = require('./routes/rechargeRoutes');
const userRoutes             = require('./routes/userRoutes');
const commissionRoutes       = require('./routes/commissionRoutes');

const adminAuthRoutes        = require('./routes/adminAuthRoutes');
const adminDashboardRoutes   = require('./routes/adminDashboardRoutes');
const adminTransactionRoutes = require('./routes/adminTransactionRoutes');
const adminCommissionRoutes  = require('./routes/adminCommissionRoutes');
const adminUserRoutes        = require('./routes/adminUserRoutes');
const adminRechargeRoutes    = require('./routes/adminRechargeRoutes');
const adminJobRoutes         = require('./routes/adminJobRoutes');

const driverRoutes           = require('./routes/driverRoutes');
const passengerRoutes        = require('./routes/passengerRoutes');
const vendorRoutes           = require('./routes/vendorRoutes');

const paymentsRoutes         = require('./routes/paymentsRoutes');
const geocodeRoutes          = require('./routes/geocodeRoutes');
const rentalRoutes           = require('./routes/rentalRoutes');

const processScheduledTrips  = require('./utils/scheduledTripProcessor');

// ========== ربط المسارات ==========
app.use('/api/auth',           authRoutes);
app.use('/api/trips',          tripRoutes);

app.use('/api/wallet',         walletRoutes);
// (اختياري للتوافقية مع استدعاءات قديمة مثل /api/wallets/me)
app.use('/api/wallets',        walletRoutes);

app.use('/api/transactions',   transactionRoutes);
app.use('/api/recharge',       rechargeRoutes);
app.use('/api/users',          userRoutes);
app.use('/api/commission',     commissionRoutes);

app.use('/api/admin',                  adminAuthRoutes);
app.use('/api/admin',                  adminDashboardRoutes);
app.use('/api/admin/transactions',     adminTransactionRoutes);
app.use('/api/admin/commission',       adminCommissionRoutes);
app.use('/api/admin/users',            adminUserRoutes);
app.use('/api/admin/recharge',         adminRechargeRoutes);
app.use('/api/admin/jobs',             adminJobRoutes);

app.use('/api/driver',         driverRoutes);
app.use('/api/passenger',      passengerRoutes);
app.use('/api/vendor',         vendorRoutes);

app.use('/api/payments',       paymentsRoutes);
app.use('/api/geocode',        geocodeRoutes);
app.use('/api/rentals',        rentalRoutes);

// صفحة اختبار وصحّة
app.get('/', (req, res) => res.send('🚀 منصة النقل السورية تعمل بنجاح!'));
app.get('/api/health', (req, res) =>
  res.json({ ok: true, mongo: mongoose.connection.readyState }) // 1 = connected
);

// ========== الاتصال بقاعدة البيانات ثم تشغيل الخادم ==========
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ تم الاتصال بـ MongoDB');

    const cn = mongoose.connection;
    const rawUrl =
      (cn.client && cn.client.s && cn.client.s.url) || process.env.MONGO_URI || '';
    const safeUrl = rawUrl.replace(/\/\/([^:@]*):([^@]*)@/, '//$1:***@'); // إخفاء كلمة مرور إن وُجدت
    console.log('Mongo DB =', cn.name, safeUrl);

    const server = app.listen(PORT, () => {
      console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);

      // ⏱️ شغّل معالجة الرحلات المجدولة (يمكن تعطيلها بوضع RUN_JOBS=false)
      if ((process.env.RUN_JOBS || 'true').toLowerCase() === 'true') {
        setInterval(processScheduledTrips, 60 * 1000);
      }
    });

    // إغلاق أنيق
    const shutdown = async (signal = 'SIGTERM') => {
      try {
        console.log(`🛑 ${signal} received. Shutting down...`);

        // 1) أوقف استقبال اتصالات HTTP جديدة
        if (server && server.close) {
          await new Promise((resolve) => server.close(resolve));
        }

        // 2) أغلق اتصال مونغو (بدون callback وبدون وسيطات)
        // يمكن استخدام أيٍّ منهما:
        await mongoose.connection.close();   // أو:
        // await mongoose.disconnect();

        console.log('👋 Closed MongoDB connection. Bye!');
        process.exit(0);
      } catch (err) {
        console.error('❌ Shutdown error:', err);
        process.exit(1);
      }
    };

    // إشارات الإنهاء
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // (اختياري) مهلة قتل قسرية إذا علِق الإغلاق
    process.on('SIGINT', () => setTimeout(() => process.exit(1), 5000)).once;
  })
  .catch((err) => {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
    process.exit(1);
  });
