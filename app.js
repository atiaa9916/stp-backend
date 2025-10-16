// app.js
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');

const app  = express();

// خلف Proxy (إن وُجد)
app.set('trust proxy', 1);

// ========== Middleware ==========
app.use(express.json());
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));

// طبّق الـ rate-limit على /api فقط
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// CORS من .env
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));

// منع الكاش
app.set('etag', false);
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ملفات ثابتة
const uploadsDir = path.join(__dirname, 'uploads', 'shamcash');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== المسارات ==========
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

// ربط
app.use('/api/auth',           authRoutes);
app.use('/api/trips',          tripRoutes);

app.use('/api/wallet',         walletRoutes);
app.use('/api/wallets',        walletRoutes); // توافق قديم

app.use('/api/transactions',   transactionRoutes);
app.use('/api/recharge',       rechargeRoutes);
// توافق لمسار قديم كان في الواجهة:
/** ملاحظة: لا يوجد ملف vendorRechargeRoutes — نعيد استخدام نفس الـ router */
app.use('/api/vendor/recharge', rechargeRoutes);

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

// صحّة
app.get('/', (req, res) => res.send('🚀 منصة النقل السورية تعمل بنجاح!'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;
