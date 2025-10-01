// models/rechargeCodeModel.js

const mongoose = require('mongoose');

const rechargeCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1000
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  isDisabled: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // ✅ تم تعديل الحقل ليصبح اختياريًا ومرنًا
  expiresAt: {
    type: Date,
    default: null // اختياري حاليًا
  }
});

module.exports = mongoose.model('RechargeCode', rechargeCodeSchema);
