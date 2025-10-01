// models/CommissionSettings.js
const mongoose = require('mongoose');

const CommissionSettingsSchema = new mongoose.Schema({
  // النوع: نسبة ثابتة أو مبلغ ثابت (أو ذكي لاحقًا)
  type: { type: String, enum: ['fixedAmount', 'fixedPercentage', 'smartDynamic'], default: 'fixedAmount' },
  value: { type: Number, default: 0 },            // إن كان fixedAmount = 1500 مثلًا، أو قيمة النسبة إن كان fixedPercentage
  applies: { wallet: { type: Boolean, default: true }, cash: { type: Boolean, default: false } },
  chargeStage: { type: String, enum: ['accepted','completed'], default: 'completed' },
  isActive: { type: Boolean, default: true },
  note: { type: String }
}, {
  timestamps: true,
  collection: 'commissionsettings' // مهم: نفس اسم المجموعة التي أنشأتها في mongosh
});

module.exports = mongoose.model('CommissionSettings', CommissionSettingsSchema);
