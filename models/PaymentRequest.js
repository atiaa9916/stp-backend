const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1000 },
  method: { type: String, enum: ['visa', 'shamcash', 'cash'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

  // شام كاش
  proofImage: { type: String, default: null },   // مسار الصورة/الملف
  transactionId: { type: String, default: null },// رقم العملية من شام كاش (إن وُجد)

  // إدارة
  adminNotes: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
