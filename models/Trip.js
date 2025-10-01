const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: { type: [Number], required: true }, // [lng, lat]
  address: { type: String }
}, { _id: false });

const tripSchema = new mongoose.Schema(
  {
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driver:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pickupLocation:  { type: pointSchema, required: true },
    dropoffLocation: { type: pointSchema, required: true },
    fare: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['scheduled','ready','pending','accepted','in_progress','completed','cancelled'], default: 'pending' },
    uniqueRequestId: { type: String, unique: true, sparse: true },
    paid: { type: Boolean, default: false },
    paymentMethod: { type: String, enum: ['cash','wallet','bank'], default: 'cash' },
    isScheduled: { type: Boolean, default: false },
    scheduledDateTime: { type: Date }
  },
  { timestamps: true }
);

tripSchema.index({ pickupLocation: '2dsphere' });
tripSchema.index({ dropoffLocation: '2dsphere' });

const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;
