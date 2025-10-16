// models/Wallet.js
const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema(
  {
    // ✅ الحقل الموحّد (بدون index/unique هنا لتجنّب ازدواجية تعريف المؤشر)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    balance:  { type: Number, default: 0 },
    currency: { type: String, default: 'SYP' },
  },
  { timestamps: true, collection: 'wallets' }
);

// ✅ تعريف واحد وواضح للفهرس (unique) على user
WalletSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('Wallet', WalletSchema);
