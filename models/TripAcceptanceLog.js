const mongoose = require('mongoose');

const tripAcceptanceLogSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true
    },
    acceptedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const TripAcceptanceLog = mongoose.model('TripAcceptanceLog', tripAcceptanceLogSchema);
module.exports = TripAcceptanceLog;
