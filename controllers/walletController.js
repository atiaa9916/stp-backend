// controllers/walletController.js
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const CURRENCY = 'SYP';

// سجل معاملة بأمان (لا يُسقط الطلب لو فشل التسجيل)
async function logTxnSafe(doc, session) {
  try {
    const now = new Date();
    const base = { createdAt: now, updatedAt: now };
    await Transaction.create([{ ...doc, ...base, desc: doc.desc ?? doc.description }], { session });
  } catch (e) {
    console.warn('Transaction log failed:', e.message);
  }
}

// upsert محفظة + توحيد إلى userId (مع معالجة صارمة لمشكلة $unset + strict)
async function upsertWallet(uidRaw, session) {
  const uid = uidRaw instanceof mongoose.Types.ObjectId ? uidRaw : new mongoose.Types.ObjectId(uidRaw);
  const now = new Date();

  // 1) upsert بدون $unset لتجنّب strict error
  const w = await Wallet.findOneAndUpdate(
    { $or: [{ userId: uid }, { user: uid }] },
    {
      $setOnInsert: { userId: uid, balance: 0, currency: CURRENCY, createdAt: now },
      $set: { updatedAt: now },
      // لا $unset هنا أثناء upsert
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      strict: false,         // المهم لتفادي Path "user" is not in schema مع upsert
      session,
    }
  );

  // 2) بعد أن أصبحت لدينا وثيقة، احذف أي حقل قديم user إن وجد
  try {
    await Wallet.updateOne({ _id: w._id, user: { $exists: true } }, { $unset: { user: '' } }, { session });
  } catch (e) {
    // لا نُسقط العملية: فقط تحذير
    console.warn('Wallet cleanup (unset user) failed:', e.message);
  }

  return w;
}

// 📥 إنشاء محفظة لمستخدم (يُستدعى عند التسجيل)
exports.createWalletForUser = async (userId) => {
  try { await upsertWallet(userId); }
  catch (error) { console.error('❌ فشل إنشاء المحفظة:', error.message); }
};

// 📄 جلب رصيد المستخدم الحالي (نسخة نظيفة بعد التطبيع)
exports.getMyBalance = async (req, res) => {
  try {
    const raw = req.user?._id || req.user?.id || req.user?.userId;
    if (!raw) return res.status(401).json({ message: 'رمز الوصول لا يحوي معرّف مستخدم' });

    let uid;
    try { uid = new mongoose.Types.ObjectId(raw); }
    catch { return res.status(400).json({ message: 'معرّف المستخدم غير صالح' }); }

    const now = new Date();

    // تأكيد وجود المحفظة
    let w = await Wallet.findOne({ userId: uid }).lean();
    if (!w) {
      w = await Wallet.create({ userId: uid, balance: 0, currency: CURRENCY });
    }

    // حساب الرصيد الدفتري من معاملات المستخدم فقط
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

    // مزامنة المحفظة لو اختلفت
    if ((Number(w.balance) || 0) !== ledger) {
      await Wallet.updateOne(
        { _id: w._id },
        { $set: { balance: ledger, currency: w.currency || CURRENCY, updatedAt: now } }
      );
    }

    return res.status(200).json({ balance: ledger, currency: w?.currency || CURRENCY });
  } catch (err) {
    console.error('getMyBalance error:', err);
    return res.status(500).json({ message: 'فشل جلب الرصيد' });
  }
};

// ➕ شحن الرصيد
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
          { userId: w.userId, type: 'credit', amount: amt, description: 'شحن رصيد المحفظة' },
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

// 🔁 تحويل رصيد (يسمح فقط driver ↔ passenger)
exports.transferBalance = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { recipientPhone, amount } = req.body;
    const amt = Number(amount);

    if (!recipientPhone || !Number.isFinite(amt) || amt <= 0)
      return res.status(400).json({ message: 'البيانات غير مكتملة أو المبلغ غير صالح' });

    const [senderUser, recipientUser] = await Promise.all([
      User.findById(senderId),
      User.findOne({ phone: recipientPhone })
    ]);
    if (!recipientUser)
      return res.status(404).json({ message: 'المستخدم المستلم غير موجود' });

    // السماح فقط (driver→passenger | passenger→driver)
    const allowed =
      (senderUser.role === 'driver' && recipientUser.role === 'passenger') ||
      (senderUser.role === 'passenger' && recipientUser.role === 'driver');
    if (!allowed)
      return res.status(403).json({ message: `❌ التحويل غير مسموح بين ${senderUser.role} و ${recipientUser.role}` });

    // حد أدنى يجب أن يبقى بعد التحويل
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

      await logTxnSafe({ userId: wSender.userId, type: 'debit',  amount: amt, description: `تحويل إلى ${recipientUser.phone}` }, session);
      await logTxnSafe({ userId: wRecip.userId,  type: 'credit', amount: amt, description: `استلام من ${senderUser.phone}` }, session);

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
