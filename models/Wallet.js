// models/Wallet.js
const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      index: true,
      required: true,
    },
    balance:  { type: Number, default: 0 },
    currency: { type: String, default: 'SYP' },
  },
  { timestamps: true, collection: 'wallets' }
);

module.exports = mongoose.model('Wallet', WalletSchema);