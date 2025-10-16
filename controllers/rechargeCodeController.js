// controllers/rechargeCodeController.js
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const RechargeCode = require('../models/rechargeCodeModel');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

// =============== Helpers ===============
const ensureCreatedAt = (doc) =>
  doc?.createdAt ||
  (doc?._id && typeof doc._id.getTimestamp === 'function'
    ? doc._id.getTimestamp()
    : null);

const toISO = (d) => (d ? new Date(d).toISOString() : null);

const toPlainUser = (u) =>
  u ? { name: u.name ?? null, phoneNumber: u.phone ?? u.phoneNumber ?? null } : null;

/** اختَر أفضل محفظة (الأعلى رصيدًا ثم الأحدث تحديثًا) أو أنشئ واحدة بمرجع موحّد */
async function findOrCreateWallet(userId, session) {
  const wallets = await Wallet.find({
    $or: [{ user: userId }, { userId }]
  })
    .session(session || null)
    .sort({ balance: -1, updatedAt: -1 });

  if (wallets.length > 0) return wallets[0];

  // إنشاء محفظة جديدة بمرجع موحّد
  const [created] = await Wallet.create(
    [{ user: userId, userId, balance: 0 }],
    { session: session || null }
  );
  return created;
}

/** إنشاء سجل معاملة بتوافق خلفي user/userId + description/desc */
async function addTx({ userId, type, amount, method, description }, session) {
  return Transaction.create(
    [{
      userId,
      user: userId,            // توافق خلفي
      type,
      amount,
      method,
      description,
      desc: description        // توافق خلفي
    }],
    { session: session || null }
  );
}

// =============== 1) إنشاء رمز شحن واحد ===============
exports.createRechargeCode = async (req, res) => {
  try {
    const { amount, expiresInDays } = req.body;
    if (!amount || amount < 1000)
      return res.status(400).json({ error: 'القيمة غير صحيحة أو أقل من الحد الأدنى' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 30));

    const newCode = await RechargeCode.create({
      code: uuidv4(),
      amount,
      vendorId: req.user._id,
      expiresAt,
    });

    return res.status(201).json({
      message: '✅ تم إنشاء رمز الشحن بنجاح',
      data: {
        code: newCode.code,
        amount: newCode.amount,
        createdAt: toISO(ensureCreatedAt(newCode)),
        expiresAt: toISO(newCode.expiresAt),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'حدث خطأ أثناء إنشاء رمز الشحن', details: err.message });
  }
};

// =============== 2) إنشاء دفعة رموز ===============
exports.createRechargeCodesBatch = async (req, res) => {
  try {
    const { amount, count, expiresInDays } = req.body;
    if (!amount || amount < 1000 || !count || count < 1 || count > 100)
      return res.status(400).json({ error: 'البيانات غير صحيحة. تحقق من القيم.' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 30));

    const vendorId = req.user._id;
    const docs = Array.from({ length: count }).map(() => ({
      code: uuidv4(),
      amount,
      vendorId,
      expiresAt,
    }));

    const saved = await RechargeCode.insertMany(docs);

    return res.status(201).json({
      message: `✅ تم إنشاء ${saved.length} رمز شحن بنجاح`,
      data: saved.map((c) => ({
        code: c.code,
        amount: c.amount,
        createdAt: toISO(ensureCreatedAt(c)),
        expiresAt: toISO(c.expiresAt),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'فشل توليد الدفعة', details: err.message });
  }
};

// =============== 3) إحصائيات البائع ===============
exports.getVendorRechargeStats = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const codes = await RechargeCode.find({ vendorId });

    const totalCreated = codes.length;
    const totalUsed = codes.filter((c) => c.isUsed).length;
    const totalUnused = codes.filter((c) => !c.isUsed && !c.isDisabled).length;
    const totalAmountUsed = codes.filter((c) => c.isUsed).reduce((s, c) => s + c.amount, 0);
    const totalAmountUnused = codes.filter((c) => !c.isUsed && !c.isDisabled).reduce((s, c) => s + c.amount, 0);
    const lastUsedDate = codes.filter((c) => c.isUsed && c.usedAt).sort((a, b) => b.usedAt - a.usedAt)[0]?.usedAt || null;

    return res.status(200).json({
      message: '📊 إحصائيات شحن البائع',
      data: { totalCreated, totalUsed, totalUnused, totalAmountUsed, totalAmountUnused, lastUsedDate: toISO(lastUsedDate) },
    });
  } catch (err) {
    return res.status(500).json({ error: 'فشل في جلب الإحصائيات', details: err.message });
  }
};

// =============== 4) سجل الاستخدام من قبل العملاء ===============
exports.getRechargeUsageByVendor = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const usedCodes = await RechargeCode.find({ vendorId, isUsed: true })
      .populate('usedBy', 'name phone phoneNumber')
      .sort({ usedAt: -1 });

    const result = usedCodes.map((code) => ({
      code: code.code,
      amount: code.amount,
      usedBy: code.usedBy ? `${code.usedBy.name} (${code.usedBy.phone || code.usedBy.phoneNumber})` : 'غير معروف',
      usedAt: code.usedAt ? new Date(code.usedAt).toLocaleString('ar-EG') : 'غير متوفر',
    }));

    return res.status(200).json({ message: '📄 قائمة الرموز المستخدمة', data: result });
  } catch (err) {
    return res.status(500).json({ error: 'فشل في جلب الرموز المستخدمة', details: err.message });
  }
};

// =============== 5) الرموز غير المستخدمة للبائع ===============
exports.getUnusedRechargeCodesByVendor = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const unusedCodes = await RechargeCode.find({ vendorId, isUsed: false, isDisabled: false }).sort({ createdAt: -1 });

    const result = unusedCodes.map((code) => ({
      code: code.code,
      amount: code.amount,
      createdAt: toISO(ensureCreatedAt(code)),
      expiresAt: toISO(code.expiresAt),
    }));

    return res.status(200).json({ message: '📄 قائمة الرموز غير المستخدمة', data: result });
  } catch (err) {
    return res.status(500).json({ error: 'فشل في جلب الرموز غير المستخدمة', details: err.message });
  }
};

// =============== 6) جميع رموز البائع ===============
exports.getMyRechargeCodes = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const codes = await RechargeCode.find({ vendorId })
      .populate('usedBy', 'name phone phoneNumber')
      .sort({ createdAt: -1 })
      .lean();

    const result = codes.map((code) => ({
      code: code.code,
      amount: code.amount,
      isUsed: !!code.isUsed,
      isDisabled: !!code.isDisabled,
      usedBy: toPlainUser(code.usedBy),
      usedAt: toISO(code.usedAt),
      createdAt: toISO(ensureCreatedAt(code)),
      expiresAt: toISO(code.expiresAt),
    }));

    return res.status(200).json({ message: '📄 جميع رموز الشحن الخاصة بالبائع', data: result });
  } catch (err) {
    return res.status(500).json({ error: 'فشل في جلب رموز الشحن', details: err.message });
  }
};

// =============== 7) استخدام رمز الشحن (للعميل) ===============
exports.useRechargeCode = async (req, res) => {
  let session;
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) return res.status(400).json({ message: 'الرمز مطلوب' });

    const rechargeCode = await RechargeCode.findOne({ code });
    if (!rechargeCode)  return res.status(404).json({ message: 'رمز الشحن غير موجود' });
    if (rechargeCode.isDisabled) return res.status(403).json({ message: '❌ هذا الرمز تم تعطيله ولا يمكن استخدامه' });
    if (rechargeCode.isUsed)     return res.status(400).json({ message: '❌ تم استخدام هذا الرمز مسبقاً' });
    if (rechargeCode.expiresAt && rechargeCode.expiresAt < new Date())
      return res.status(400).json({ message: '❌ انتهت صلاحية هذا الرمز' });

    session = await mongoose.startSession();
    let newBalance;

    await session.withTransaction(async () => {
      const wallet = await findOrCreateWallet(userId, session);

      wallet.balance += rechargeCode.amount;
      await wallet.save({ session });

      rechargeCode.isUsed = true;
      rechargeCode.usedBy = userId;
      rechargeCode.usedAt = new Date();
      await rechargeCode.save({ session });

      await addTx({
        userId,
        type: 'credit',
        amount: rechargeCode.amount,
        method: 'wallet', // لا نغيّره حتى تبقى كل التقارير متناسقة
        description: `شحن باستخدام الرمز ${rechargeCode.code}`
      }, session);

      newBalance = wallet.balance;
    });

    return res.status(200).json({
      message: `✅ تم شحن رصيدك بمبلغ ${rechargeCode.amount} ل.س`,
      newBalance
    });
  } catch (err) {
    return res.status(500).json({ message: 'فشل استخدام الرمز', error: err.message });
  } finally {
    if (session) await session.endSession();
  }
};

// =============== 8) حذف/تعطيل رمز (للبائع) ===============
exports.deleteRechargeCode = async (req, res) => {
  try {
    const { code } = req.params;
    const vendorId = req.user._id;

    const rechargeCode = await RechargeCode.findOne({ code, vendorId });
    if (!rechargeCode) return res.status(404).json({ message: 'رمز الشحن غير موجود أو لا تملكه' });
    if (rechargeCode.isUsed)   return res.status(400).json({ message: '❌ لا يمكن حذف رمز تم استخدامه بالفعل' });

    rechargeCode.isDisabled = true;
    await rechargeCode.save();

    return res.status(200).json({ message: '✅ تم تعطيل الرمز بنجاح. لم يعد قابلًا للاستخدام.' });
  } catch (err) {
    return res.status(500).json({ message: 'فشل في تعطيل الرمز', error: err.message });
  }
};

// =============== 9) تعطيل رمز فقط ===============
exports.disableRechargeCode = async (req, res) => {
  try {
    const { code } = req.params;
    const vendorId = req.user._id;

    const rechargeCode = await RechargeCode.findOne({ code, vendorId });
    if (!rechargeCode) return res.status(404).json({ message: 'رمز الشحن غير موجود أو لا تملكه' });
    if (rechargeCode.isDisabled) return res.status(400).json({ message: '❌ الرمز معطل مسبقًا' });
    if (rechargeCode.isUsed)     return res.status(400).json({ message: '❌ لا يمكن تعطيل رمز تم استخدامه' });

    rechargeCode.isDisabled = true;
    await rechargeCode.save();

    return res.status(200).json({ message: '✅ تم تعطيل الرمز بنجاح' });
  } catch (err) {
    return res.status(500).json({ message: 'فشل في تعطيل الرمز', error: err.message });
  }
};

// =============== 10) QR ===============
exports.getRechargeCodeQR = async (req, res) => {
  try {
    const { code } = req.params;
    const rechargeCode = await RechargeCode.findOne({ code });
    if (!rechargeCode) return res.status(404).json({ message: 'رمز الشحن غير موجود' });

    const qrData = `Recharge Code: ${rechargeCode.code} - Amount: ${rechargeCode.amount} L.S`;
    const qrImage = await QRCode.toDataURL(qrData);

    return res.status(200).json({ message: '✅ تم توليد صورة QR بنجاح', qrImage, code: rechargeCode.code, amount: rechargeCode.amount });
  } catch (err) {
    return res.status(500).json({ message: 'فشل في توليد QR', error: err.message });
  }
};

// =============== 11) معاملات الشحن الخاصة بالبائع (مُعزّزة بالـ RegExp + ربط) ===============
exports.getRechargeTransactionsByVendor = async (req, res) => {
  try {
    const vendorId = req.user._id;

    // 1) اجلب كل المعاملات التي تحتوي عبارة "شحن باستخدام الرمز <code>"
    //    ثم استخرج الأكواد من الوصف
    const regex = /شحن باستخدام الرمز\s+([0-9a-fA-F-]+)/; // يلتقط UUID
    const txCandidates = await Transaction.find({
      $or: [
        { description: { $regex: /شحن باستخدام الرمز / } },
        { desc:        { $regex: /شحن باستخدام الرمز / } },
      ],
    })
      .populate('userId', 'name phone phoneNumber')
      .sort({ createdAt: -1 })
      .lean();

    // استخرج الأكواد الموجودة في الوصف/desc
    const extracted = txCandidates
      .map(tx => {
        const text = tx.description || tx.desc || '';
        const m = text.match(regex);
        return m ? { tx, code: m[1] } : null;
      })
      .filter(Boolean);

    let data = [];

    if (extracted.length > 0) {
      // اجلب الرموز المطابقة والمملوكة للبائع الحالي
      const codes = extracted.map(x => x.code);
      const rcByCode = await RechargeCode.find({
        code: { $in: codes },
        vendorId: vendorId,
      })
        .populate('usedBy', 'name phone phoneNumber')
        .lean();

      const allow = new Set(rcByCode.map(c => c.code));
      const mapUser = (u) => (u ? { name: u.name ?? null, phoneNumber: u.phone ?? u.phoneNumber ?? null } : null);

      // احتفظ فقط بالمعاملات التي تنتمي فعلاً لرموز هذا البائع
      data = extracted
        .filter(x => allow.has(x.code))
        .map(({ tx, code }) => ({
          _id: tx._id,
          amount: tx.amount,
          type: tx.type,
          method: tx.method,
          description: tx.description || tx.desc || '',
          createdAt: tx.createdAt,
          user: mapUser(tx.userId),
          code,
        }));
    }

    // 2) إن لم نجد شيئًا بالطريقة السابقة، نعود للمسار التقليدي (fallback)
    if (data.length === 0) {
      const usedCodes = await RechargeCode.find({ vendorId, isUsed: true })
        .populate('usedBy', 'name phone phoneNumber')
        .sort({ usedAt: -1 })
        .lean();

      if (usedCodes.length > 0) {
        const mapUser = (u) => (u ? { name: u.name ?? null, phoneNumber: u.phone ?? u.phoneNumber ?? null } : null);
        data = usedCodes.map((c) => ({
          _id: c._id,
          amount: c.amount,
          type: 'credit',
          method: 'wallet',
          description: `شحن باستخدام الرمز ${c.code}`,
          createdAt: c.usedAt || c.updatedAt || c.createdAt,
          user: mapUser(c.usedBy),
          code: c.code,
        }));
      }
    }

    return res.status(200).json({ message: '📄 معاملات الشحن عبر رموز هذا البائع', data });
  } catch (err) {
    return res.status(500).json({ message: 'فشل في جلب المعاملات الخاصة بالبائع', error: err.message });
  }
};
