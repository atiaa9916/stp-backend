const mongoose = require('mongoose');
const SettingSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: Number,
  percent: Number,
  applies: { wallet: {type:Boolean, default:true}, cash: {type:Boolean, default:false} },
  chargeStage: { type:String, enum:['accepted','completed'], default:'completed' },
  isActive: { type:Boolean, default:true },
}, { timestamps:true, collection:'settings' });

module.exports = mongoose.model('Setting', SettingSchema);
