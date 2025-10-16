// models/CommissionSettings.js
const mongoose = require('mongoose');

const CommissionSettingsSchema = new mongoose.Schema(
  {
    // النوع: مبلغ ثابت / نسبة ثابتة / ذكي لاحقًا
    type: {
      type: String,
      enum: ['fixedAmount', 'fixedPercentage', 'smartDynamic'],
      default: 'fixedAmount',
      required: true,
    },

    // القيمة: إن كان fixedAmount = 1500 مثلًا، أو قيمة النسبة إن كان fixedPercentage
    value: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },

    // إلى أي طرق دفع تُطبّق العمولة
    applies: {
      wallet: { type: Boolean, default: true },
      cash:   { type: Boolean, default: false },
    },

    // متى تُحتسب العمولة
    chargeStage: {
      type: String,
      enum: ['accepted', 'completed'],
      default: 'completed',
      required: true,
    },

    // التفعيل
    isActive: { type: Boolean, default: true },

    // ملاحظة اختيارية
    note: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'commissionsettings',
  }
);

// فهارس مفيدة
CommissionSettingsSchema.index({ isActive: 1, updatedAt: -1 });
CommissionSettingsSchema.index({ updatedAt: -1, createdAt: -1 });

module.exports = mongoose.model('CommissionSettings', CommissionSettingsSchema);
