const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


// تحديد البنية
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'الاسم مطلوب'],
      minlength: 2,
      maxlength: 50,
    },
    phone: {
      type: String,
      required: [true, 'رقم الجوال مطلوب'],
      unique: true,
      match: [/^[0-9]{9,15}$/, 'رقم الجوال غير صالح'],
    },
    password: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة'],
      minlength: 6,
      select: false // لا تُرجع في الاستعلامات تلقائيًا
    },
    role: {
     type: String,
     enum: ['passenger', 'driver', 'vendor', 'admin'], // ✅ تم إضافة vendor هنا
     default: 'passenger'
    },

    isActive: {
      type: Boolean,
      default: true
    },
  },
  { timestamps: true }
);

// تشفير كلمة المرور قبل الحفظ
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); // لا تُشفّر إذا لم تتغير
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// مقارنة كلمة المرور (للتحقق أثناء تسجيل الدخول)
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
