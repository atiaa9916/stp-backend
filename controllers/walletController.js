// controllers/walletController.js
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const CURRENCY = 'SYP';

/** يسجل معاملة بدون تعطيل المسار لو فشل السجل */
async function logTxnSafe(doc, session) {
  try {
    const now = new Date();
    const base = { createdAt: now, updatedAt: now };

    // ملاحظة: ما زلنا نكتب المعاملة على الحقل userId (توافقًا مع بقية المنظومة الحالية).
    // إن رغبت لاحقًا توحيد Transaction إلى user أيضًا، أخبرني أعدّها كلها دفعة واحدة.
    await Transaction.create([{ ...doc, ...base, desc: doc.desc ?? doc.description }], { session });
  } catch (e) {
    console.warn('Transaction log failed:', e.message);
  }
}

/** Upsert محفظة بالحقل الموحّد user + تنظيف أي أثر قديم لـ userId */
async function upsertWallet(uidRaw, session) {
  const uid = uidRaw instanceof mongoose.Types.ObjectId ? uidRaw : new mongoose.Types.ObjectId(uidRaw);
  const now = new Date();

  // ابحث بأي من الحقلين (توافق قديم)، وثبّت الإدراج على user فقط
  const w = await Wallet.findOneAndUpdate(
    { $or: [{ user: uid }, { userId: uid }] },           // userId دعم مؤقت للانتقال
    { $setOnInsert: { user: uid, balance: 0, currency: CURRENCY, createdAt: now },
      $set: { updatedAt: now } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  // تنظيف أي userId قديم إن وجد (مرحلة انتقالية)
  try {
    await Wallet.updateOne(
      { _id: w._id, userId: { $exists: true } },
      { $unset: { userId: '' } },
      { session }
    );
  } catch (e) {
    console.warn('Wallet cleanup (unset userId) failed:', e.message);
  }

  return w;
}

/** إنشاء محفظة عند التسجيل */
exports.createWalletForUser = async (userId) => {
  try { await upsertWallet(userId); }
  catch (error) { console.error('❌ فشل إنشاء المحفظة:', error.message); }
};

/** جلب رصيد المستخدم الحالي */
exports.getMyBalance = async (req, res) => {
  try {
    const raw = req.user?._id || req.user?.id || req.user?.userId;
    if (!raw) return res.status(401).json({ message: 'رمز الوصول لا يحوي معرّف مستخدم' });

    let uid;
    try { uid = new mongoose.Types.ObjectId(raw); }
    catch { return res.status(400).json({ message: 'معرّف المستخدم غير صالح' }); }

    // تأكيد وجود المحفظة بالحقل الموحّد
    let w = await Wallet.findOne({ user: uid }).lean();
    if (!w) w = await Wallet.create({ user: uid, balance: 0, currency: CURRENCY });

    // نحسب الرصيد الدفتري من جدول المعاملات (ما زال يعتمد userId حاليًا)
    const [sum = {}] = await Transaction.collection.aggregate([
      { $match: { userId: uid } },
      {
        $group: {
          _id: null,
          credit: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
          debit:  { $sum: { $cond: [{ $eq: ['$type', 'debit' ] }, '$amount', 0] } },
        },
      },
      { $project: { _id: 0, ledger: { $subtract: ['$credit', '$debit'] } } },
    ]).toArray();

    const ledger = Number(sum.ledger || 0);

    // مزامنة الحقل الحسابي balance مع الدفتري
    if ((Number(w.balance) || 0) !== ledger) {
      await Wallet.updateOne(
        { _id: w._id },
        { $set: { balance: ledger, currency: w.currency || CURRENCY, updatedAt: new Date() } }
      );
    }

    return res.status(200).json({ balance: ledger, currency: w?.currency || CURRENCY });
  } catch (err) {
    console.error('getMyBalance error:', err);
    return res.status(500).json({ message: 'فشل جلب الرصيد' });
  }
};

/** شحن الرصيد */
exports.chargeBalance = async (req, res) => {
  try {
    const amt = Number(req.body?.amount);
    if (!Number.isFinite(amt) || !Number.isInteger(amt) || amt <= 0)
      return res.status(400).json({ message: 'مبلغ غير صالح' });

    const session = await mongoose.startSession();
    let w;
    try {
      await session.withTransaction(async () => {
        w = await upsertWallet(req.user._id, session);
        await Wallet.updateOne(
          { _id: w._id },
          { $inc: { balance: amt }, $set: { updatedAt: new Date() } },
          { session }
        );
        await logTxnSafe(
          { userId: w.user, type: 'credit', amount: amt, description: 'شحن رصيد المحفظة' },
          session
        );
        w = await Wallet.findById(w._id).session(session);
      });
    } finally {
      session.endSession();
    }

    res.status(200).json({ message: 'تم شحن الرصيد بنجاح', balance: w.balance });
  } catch (error) {
    console.error('chargeBalance error:', error);
    res.status(500).json({ message: 'فشل شحن الرصيد', error: error.message });
  }
};

/** كشف الحركات (Statement) */
exports.getStatement = async (req, res) => {
  try {
    const raw = req.user?._id || req.user?.id || req.user?.userId;
    if (!raw) return res.status(401).json({ message: 'رمز الوصول لا يحوي معرّف مستخدم' });

    let uid;
    try { uid = new mongoose.Types.ObjectId(raw); }
    catch { return res.status(400).json({ message: 'معرّف المستخدم غير صالح' }); }

    const q = req.query || {};
    const limitInput = parseInt(q.limit, 10);
    const pageInput  = parseInt(q.page, 10);

    const limit = Math.min(Math.max(Number.isFinite(limitInput) ? limitInput : 20, 1), 50);
    const page  = Math.max(Number.isFinite(pageInput) ? pageInput : 1, 1);
    const skip  = (page - 1) * limit;

    // ما زالت المعاملات تعتمد userId (توافقًا)
    const match = { userId: uid };
    if (q.type === 'credit' || q.type === 'debit') match.type = q.type;
    if (q.before || q.after) {
      match.createdAt = {};
      if (q.before) match.createdAt.$lt = new Date(q.before);
      if (q.after)  match.createdAt.$gt = new Date(q.after);
    }

    const [items, total] = await Promise.all([
      Transaction.find(
        match,
        { _id: 1, type: 1, amount: 1, createdAt: 1, desc: 1 }
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
      Transaction.countDocuments(match),
    ]);

    return res.status(200).json({ items, total, page, limit });
  } catch (err) {
    console.error('getStatement error:', err);
    return res.status(500).json({ message: 'فشل جلب كشف الحركات' });
  }
};

/** تحويل رصيد (driver ↔ passenger فقط) */
exports.transferBalance = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { recipientPhone, amount } = req.body;
    const amt = Number(amount);

    if (!recipientPhone || !Number.isFinite(amt) || amt <= 0)
      return res.status(400).json({ message: 'البيانات غير مكتملة أو المبلغ غير صالح' });

    const [senderUser, recipientUser] = await Promise.all([
      User.findById(senderId),
      User.findOne({ phone: recipientPhone }),
    ]);
    if (!recipientUser)
      return res.status(404).json({ message: 'المستخدم المستلم غير موجود' });

    const allowed =
      (senderUser.role === 'driver' && recipientUser.role === 'passenger') ||
      (senderUser.role === 'passenger' && recipientUser.role === 'driver');
    if (!allowed)
      return res.status(403).json({ message: `❌ التحويل غير مسموح بين ${senderUser.role} و ${recipientUser.role}` });

    const MIN_REMAINING_BALANCE = 20000;

    const session = await mongoose.startSession();
    let senderWallet;
    await session.withTransaction(async () => {
      const wSender = await upsertWallet(senderId, session);
      const wRecip  = await upsertWallet(recipientUser._id, session);

      const after = (Number(wSender.balance) || 0) - amt;
      if (after < MIN_REMAINING_BALANCE)
        throw new Error(`لا يمكن التحويل، يجب أن يبقى في المحفظة على الأقل ${MIN_REMAINING_BALANCE} بعد التحويل`);

      await Wallet.updateOne({ _id: wSender._id }, { $inc: { balance: -amt }, $set: { updatedAt: new Date() } }, { session });
      await Wallet.updateOne({ _id: wRecip._id },  { $inc: { balance:  amt }, $set: { updatedAt: new Date() } }, { session });

      await logTxnSafe({ userId: wSender.user, type: 'debit',  amount: amt, description: `تحويل إلى ${recipientUser.phone}` }, session);
      await logTxnSafe({ userId: wRecip.user,  type: 'credit', amount: amt, description: `استلام من ${senderUser.phone}` }, session);

      senderWallet = await Wallet.findById(wSender._id).session(session);
    });
    session.endSession();

    res.status(200).json({
      message: '✅ تم تحويل الرصيد بنجاح',
      newSenderBalance: senderWallet.balance,
      transferredTo: recipientUser.phone,
    });
  } catch (error) {
    if (String(error.message || '').includes('يجب أن يبقى'))
      return res.status(400).json({ message: `❌ ${error.message}` });
    console.error('transferBalance error:', error);
    res.status(500).json({ message: 'فشل تحويل الرصيد', error: error.message });
  }
};