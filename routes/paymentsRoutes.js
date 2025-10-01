const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createShamCashRequest,
  getMyPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest,
  createVisaSession
} = require('../controllers/paymentController');

// إعداد التحميل لصور إيصالات شام كاش
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/shamcash'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split('.').pop();
    cb(null, unique + '.' + ext);
  }
});
const upload = multer({ storage });

// مستخدم: إنشاء طلب شام كاش (رفع إيصال)
router.post('/request/shamcash', protect, upload.single('proof'), createShamCashRequest);

// مستخدم: طلباتي
router.get('/my-requests', protect, getMyPaymentRequests);

// مدير: موافقة/رفض
router.patch('/:id/approve', protect, adminOnly, approvePaymentRequest);
router.patch('/:id/reject', protect, adminOnly, rejectPaymentRequest);

// فيزا (تهيئة جلسة)
router.post('/visa/create-session', protect, createVisaSession);

module.exports = router;
