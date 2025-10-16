// 📂 controllers/adminController.js

const Transaction = require('../models/Transaction');
const Trip = require('../models/Trip');
const RechargeCode = require('../models/rechargeCodeModel');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const AuditLog = require('../models/AuditLog');

/**
 * POST /api/admin/recharge/:codeId/revert
 * إلغاء استخدام رمز: خصم القيمة من محفظة المستخدم، وتعطيل الرمز.
 */
const revertRechargeCodeByAdmin = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { reason } = req.body || {};
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'السبب مطلوب لإلغاء الاستخدام' });
    }

    const code = await RechargeCode.findById(codeId);
    if (!code) return res.status(404).json({ message: 'الرمز غير موجود' });
    if (!code.isUsed || !code.usedBy) {
      return res.status(400).json({ message: 'الرمز غير مستخدم — لا حاجة للإلغاء' });
    }

    // ✅ المحفظة بالحقل الصحيح user
    const wallet = await Wallet.findOne({ user: code.usedBy });
    if (!wallet) {
      return res.status(409).json({ message: 'لا توجد محفظة للمستخدم الذي استخدم الرمز' });
    }

    // منع الرصيد السالب
    if ((wallet.balance || 0) < code.amount) {
      return res.status(409).json({ message: 'رصيد المستخدم لا يغطي مبلغ الإلغاء.' });
    }

    const prevBalance = wallet.balance;

    // الخصم + إنشاء معاملة عكسية (اعتمدنا الحقل المرجعي: user)
    wallet.balance -= code.amount;
    await wallet.save();

    await Transaction.create({
      user: code.usedBy,         // ← كان userId: استبدلناه بـ user
      type: 'debit',
      amount: code.amount,
      method: 'wallet',
      description: `إلغاء شحن برمز ${code.code} بواسطة الإدارة`,
    });

    // تحديث حالة الرمز
    code.isUsed = false;
    code.isDisabled = true;
    const affectedUser = code.usedBy;
    code.usedBy = null;
    code.usedAt = null;
    await code.save();

    // سجل التدقيق
    await AuditLog.create({
      actor: req.user._id,
      action: 'RECHARGE_REVERT',
      meta: {
        codeId: code._id.toString(),
        code: code.code,
        amount: code.amount,
        reason,
        affectedUser: affectedUser?.toString?.() || null,
        prevBalance,
        newBalance: prevBalance - code.amount,
      },
    });

    return res.status(200).json({ message: 'تم إلغاء استخدام الرمز وتعطيله بنجاح' });
  } catch (err) {
    console.error('revertRechargeCodeByAdmin error:', err);
    return res.status(500).json({ message: 'فشل في إلغاء الاستخدام', error: err.message });
  }
};

/**
 * DELETE /api/admin/recharge/:codeId?reason=...
 * حذف نهائي للرمز (مسموح فقط إذا لم يكن مستخدمًا).
 */
const deleteRechargeCodeByAdmin = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { reason } = req.query;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'السبب مطلوب لحذف الرمز' });
    }

    const code = await RechargeCode.findById(codeId);
    if (!code) return res.status(404).json({ message: 'الرمز غير موجود' });

    if (code.isUsed) {
      return res.status(400).json({ message: 'لا يمكن حذف رمز مستخدم — نفّذ "إلغاء الاستخدام" أولاً' });
    }

    await RechargeCode.deleteOne({ _id: codeId });

    await AuditLog.create({
      actor: req.user._id,
      action: 'RECHARGE_DELETE',
      meta: { codeId, code: code.code, amount: code.amount, reason },
    });

    return res.status(200).json({ message: 'تم حذف الرمز نهائيًا' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'فشل في حذف الرمز', error: err.message });
  }
};

// 📋 عرض جميع المعاملات مع تفاصيل المستخدم والرحلة
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({})
      .populate('user', 'name phone role') // ← كان userId/phoneNumber
      .populate('relatedTrip', 'pickupLocation dropoffLocation fare status')
      .sort({ createdAt: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    console.error('فشل في جلب المعاملات:', error);
    res.status(500).json({ message: 'فشل في جلب المعاملات' });
  }
};

// 📋 عرض سجل قبول الرحلات (تأكد من حقول Trip/driver لديك)
const getAcceptanceLogs = async (req, res) => {
  try {
    const logs = await Trip.find({})
      .populate('driverId', 'name phone') // ← phoneNumber ➜ phone
      .populate('tripId', 'pickupLocation dropoffLocation fare status createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json(logs);
  } catch (error) {
    console.error('فشل في جلب سجل قبول الرحلات:', error);
    res.status(500).json({ message: 'فشل في جلب سجل القبول' });
  }
};

// 📋 عرض جميع رموز الشحن مع فلاتر الحالة والتعطيل
const getAllRechargeCodes = async (req, res) => {
  try {
    const { isUsed, isDisabled } = req.query;

    const filter = {};
    if (isUsed !== undefined) filter.isUsed = isUsed === 'true';
    if (isDisabled !== undefined) filter.isDisabled = isDisabled === 'true';

    const codes = await RechargeCode.find(filter)
      .populate('vendorId', 'name')
      .populate('usedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(codes);
  } catch (error) {
    console.error('فشل في جلب رموز الشحن:', error);
    res.status(500).json({ message: 'فشل في تحميل الرموز' });
  }
};

// 📋 جلب المستخدمين مع الرصيد + فلترة الحالة والدور
const getAllUsersWithWallets = async (req, res) => {
  try {
    const { role, status } = req.query;
    const filter = {};

    if (role && role !== 'all') filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });

    const usersWithWallets = await Promise.all(
      users.map(async (user) => {
        const wallet = await Wallet.findOne({ user: user._id }); // ← كان userId
        return {
          _id: user._id,
          name: user.name,
          phone: user.phone,     // ← phoneNumber ➜ phone
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          wallet: { balance: wallet ? wallet.balance : 0 },
        };
      })
    );

    res.status(200).json(usersWithWallets);
  } catch (error) {
    console.error('خطأ في جلب المستخدمين:', error);
    res.status(500).json({ message: 'فشل في تحميل المستخدمين' });
  }
};

// ✅ تفعيل أو تعطيل مستخدم
const toggleUserActivation = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      message: `تم ${user.isActive ? 'تفعيل' : 'تعطيل'} المستخدم بنجاح`,
      isActive: user.isActive,
    });
  } catch (error) {
    console.error('فشل في تحديث حالة المستخدم:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء تحديث حالة المستخدم' });
  }
};

// 🚨 حذف مستخدم نهائيًا (إدارة فقط)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'لا يمكن حذف نفسك' });
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'المستخدم غير موجود' });

    res.status(200).json({ message: '✅ تم حذف المستخدم نهائيًا' });
  } catch (error) {
    console.error('خطأ أثناء حذف المستخدم:', error);
    res.status(500).json({ message: '❌ فشل في حذف المستخدم' });
  }
};

// 📊 إحصائيات شاملة للوحة تحكم الإدارة
const getAdminDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const driversCount = await User.countDocuments({ role: 'driver' });
    const passengersCount = await User.countDocuments({ role: 'passenger' });
    const vendorsCount = await User.countDocuments({ role: 'vendor' });
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    const wallets = await Wallet.find();
    const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    const totalRechargeCodes = await RechargeCode.countDocuments();
    const usedRechargeCodes = await RechargeCode.countDocuments({ isUsed: true });
    const unusedRechargeCodes = await RechargeCode.countDocuments({ isUsed: false });
    const disabledRechargeCodes = await RechargeCode.countDocuments({ isDisabled: true });

    const totalTransactions = await Transaction.countDocuments();
    const totalTrips = await Trip.countDocuments();

    res.status(200).json({
      users: {
        total: totalUsers,
        drivers: driversCount,
        passengers: passengersCount,
        vendors: vendorsCount,
        active: activeUsers,
        inactive: inactiveUsers,
      },
      wallets: { totalBalance },
      rechargeCodes: {
        total: totalRechargeCodes,
        used: usedRechargeCodes,
        unused: unusedRechargeCodes,
        disabled: disabledRechargeCodes,
      },
      transactions: { total: totalTransactions },
      trips: { total: totalTrips },
    });
  } catch (error) {
    console.error('خطأ في جلب إحصائيات لوحة التحكم:', error);
    res.status(500).json({ message: 'فشل في جلب إحصائيات لوحة التحكم' });
  }
};

module.exports = {
  getAllTransactions,
  getAcceptanceLogs,
  getAllRechargeCodes,
  revertRechargeCodeByAdmin,
  deleteRechargeCodeByAdmin,
  getAllUsersWithWallets,
  toggleUserActivation,
  deleteUser,
  getAdminDashboardStats,
};
