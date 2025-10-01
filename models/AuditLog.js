// models/AuditLog.js

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // المدير المنفّذ
    action: { type: String, enum: ['RECHARGE_REVERT', 'RECHARGE_DELETE'], required: true },
    meta: { type: Object, default: {} }, // { codeId, code, amount, reason, usedBy }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
