// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    // ندعم الحقلين لتوافق البيانات القديمة والجديدة
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    type:   { type: String, enum: ['debit', 'credit'], required: true }, // debit = خصم، credit = إيداع
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['wallet', 'cash', 'bank', 'system'], default: 'wallet' },

    // نوحّد على description، ونُبقي desc للتوافق
    description: { type: String },
    desc:        { type: String },

    // مرجع اختياري للرحلة
    relatedTrip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  },
  {
    timestamps: true,
    collection: 'transactions',
  }
);

// عرض نص افتراضي
TransactionSchema.virtual('displayText').get(function () {
  return this.description || this.desc || '';
});

// فهارس مركّبة مفيدة للاستعلام حسب الزمن
TransactionSchema.index({ user: 1,   createdAt: -1 });
TransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
