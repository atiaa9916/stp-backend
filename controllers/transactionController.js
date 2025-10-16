const Transaction = require('../models/Transaction');
const Trip = require('../models/Trip');

/**
 * ✨ جلب سجل المعاملات للمستخدم الحالي ببنية موحدة { value, Count }
 * - يعتمد أولاً على Transactions
 * - يضيف قيوداً مشتقة من Trip (fallback) في حال فقدان قيود مطابقة
 * - يوحِّد الوصف إلى description مع fallback إلى desc
 */
exports.getMyTransactions = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1) القيود المسجلة في transactions (يدعم user & userId)
    const q = { $or: [{ user: userId }, { userId }] };
    const baseItems = await Transaction.find(q)
      .sort({ createdAt: -1 })
      .populate('relatedTrip', '_id')
      .lean();

    // set للمقارنة ومنع التكرار
    const keyOf = (t) => [
      t.type,
      Number(t.amount) || 0,
      (t.method || '').toLowerCase(),
      t.relatedTrip ? String(t.relatedTrip._id || t.relatedTrip) : '-',
      (t.description || t.desc || '').trim()
    ].join('|');

    const byKey = new Set(baseItems.map(keyOf));

    const value = baseItems.map(t => ({
      ...t,
      description: t.description || t.desc || ''
    }));

    // 2) ✨ Fallback من الرحلات لو لم يُسجَّل Transaction موافق

    // 2.a) قيود خصم الراكب (wallet fare)
    const passengerTrips = await Trip.find({
      passenger: userId,
      paymentMethod: 'wallet',
      paid: true,
      status: 'completed',
      fare: { $gt: 0 }
    }).select('_id fare updatedAt').lean();

    for (const tr of passengerTrips) {
      const synthesized = {
        type: 'debit',
        amount: tr.fare,
        method: 'wallet',
        relatedTrip: { _id: tr._id },
        description: 'دفع أجرة رحلة من المحفظة',
        createdAt: tr.updatedAt || new Date(),
        user: userId,
        userId: userId,
      };
      const k = keyOf(synthesized);
      if (!byKey.has(k)) {
        byKey.add(k);
        value.push(synthesized);
      }
    }

    // 2.b) قيود عمولة السائق
    const driverTrips = await Trip.find({
      driver: userId,
      commissionAmount: { $gt: 0 }
    }).select('_id commissionAmount updatedAt').lean();

    for (const tr of driverTrips) {
      const synthesized = {
        type: 'debit',
        amount: tr.commissionAmount,
        method: 'wallet',
        relatedTrip: { _id: tr._id },
        description: 'خصم عمولة منصة عن رحلة',
        createdAt: tr.updatedAt || new Date(),
        user: userId,
        userId: userId,
      };
      const k = keyOf(synthesized);
      if (!byKey.has(k)) {
        byKey.add(k);
        value.push(synthesized);
      }
    }

    // ترتيب تنازلي بالتاريخ إن وُجد
    value.sort((a, b) => {
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return db - da;
    });

    return res.status(200).json({ value, Count: value.length });
  } catch (error) {
    return res.status(500).json({ message: 'فشل في جلب المعاملات', error: error.message });
  }
};
