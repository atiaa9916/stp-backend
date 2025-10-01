// 📂 controllers/rechargeCodeController.js

const QRCode = require('qrcode');
const RechargeCode = require('../models/rechargeCodeModel');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

/* أدوات مساعدة صغيرة لضمان استقرار الحقول */
const ensureCreatedAt = (doc) =>
  doc?.createdAt ||
  (doc?._id && typeof doc._id.getTimestamp === 'function'
    ? doc._id.getTimestamp()
    : null);

const toISO = (d) => (d ? new Date(d).toISOString() : null);

const toPlainUser = (u) =>
  u
    ? {
        name: u.name ?? null,
        // نوحِّد المفتاح إلى phoneNumber دائمًا
        phoneNumber: u.phone ?? u.phoneNumber ?? null,
      }
    : null;

/* ------------------------------------------------------------------
   1) إنشاء رمز شحن واحد
------------------------------------------------------------------ */
exports.createRechargeCode = async (req, res) => {
  try {
    const { amount, expiresInDays } = req.body;

    if (!amount || amount < 1000)
      return res
        .status(400)
        .json({ error: 'القيمة غير صحيحة أو أقل من الحد الأدنى' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 30));

    const newCode = await RechargeCode.create({
      code: uuidv4(),
      amount,
      vendorId: req.user._id,
      expiresAt,
    });

    const createdAt = ensureCreatedAt(newCode);

    return res.status(201).json({
      message: '✅ تم إنشاء رمز الشحن بنجاح',
      data: {
        code: newCode.code,
        amount: newCode.amount,
        createdAt: toISO(createdAt),
        expiresAt: toISO(newCode.expiresAt),
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء إنشاء رمز الشحن',
      details: err.message,
    });
  }
};

/* ------------------------------------------------------------------
   2) إنشاء دفعة رموز (Batch)
------------------------------------------------------------------ */
exports.createRechargeCodesBatch = async (req, res) => {
  try {
    const { amount, count, expiresInDays } = req.body;

    if (!amount || amount < 1000 || !count || count < 1 || count > 100)
      return res
        .status(400)
        .json({ error: 'البيانات غير صحيحة. تحقق من القيم.' });

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
    return res
      .status(500)
      .json({ error: 'فشل توليد الدفعة', details: err.message });
  }
};

/* ------------------------------------------------------------------
   3) إحصائيات البائع
------------------------------------------------------------------ */
exports.getVendorRechargeStats = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const codes = await RechargeCode.find({ vendorId });

    const totalCreated = codes.length;
    const totalUsed = codes.filter((c) => c.isUsed).length;
    const totalUnused = codes.filter((c) => !c.isUsed && !c.isDisabled).length;
    const totalAmountUsed = codes
      .filter((c) => c.isUsed)
      .reduce((s, c) => s + c.amount, 0);
    const totalAmountUnused = codes
      .filter((c) => !c.isUsed && !c.isDisabled)
      .reduce((s, c) => s + c.amount, 0);
    const lastUsedDate =
      codes
        .filter((c) => c.isUsed && c.usedAt)
        .sort((a, b) => b.usedAt - a.usedAt)[0]?.usedAt || null;

    return res.status(200).json({
      message: '📊 إحصائيات شحن البائع',
      data: {
        totalCreated,
        totalUsed,
        totalUnused,
        totalAmountUsed,
        totalAmountUnused,
        lastUsedDate: toISO(lastUsedDate),
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'فشل في جلب الإحصائيات', details: err.message });
  }
};

/* ------------------------------------------------------------------
   4) سجل الاستخدام من قبل العملاء
------------------------------------------------------------------ */
exports.getRechargeUsageByVendor = async (req, res) => {
  try {
    const vendorId = req.user._id;

    const usedCodes = await RechargeCode.find({ vendorId, isUsed: true })
      .populate('usedBy', 'name phone phoneNumber')
      .sort({ usedAt: -1 });

    const result = usedCodes.map((code) => ({
      code: code.code,
      amount: code.amount,
      usedBy: code.usedBy
        ? `${code.usedBy.name} (${
            code.usedBy.phone || code.usedBy.phoneNumber
          })`
        : 'غير معروف',
      usedAt: code.usedAt
        ? new Date(code.usedAt).toLocaleString('ar-EG')
        : 'غير متوفر',
    }));

    return res.status(200).json({
      message: '📄 قائمة الرموز المستخدمة',
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'فشل في جلب الرموز المستخدمة',
      details: err.message,
    });
  }
};

/* ------------------------------------------------------------------
   5) الرموز غير المستخدمة للبائع
------------------------------------------------------------------ */
exports.getUnusedRechargeCodesByVendor = async (req, res) => {
  try {
    const vendorId = req.user._id;

    const unusedCodes = await RechargeCode.find({
      vendorId,
      isUsed: false,
      isDisabled: false,
    }).sort({ createdAt: -1 });

    const result = unusedCodes.map((code) => ({
      code: code.code,
      amount: code.amount,
      createdAt: toISO(ensureCreatedAt(code)),
      expiresAt: toISO(code.expiresAt),
    }));

    return res.status(200).json({
      message: '📄 قائمة الرموز غير المستخدمة',
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'فشل في جلب الرموز غير المستخدمة',
      details: err.message,
    });
  }
};

/* ------------------------------------------------------------------
   6) جميع رموز البائع (لكل الحالات)
------------------------------------------------------------------ */
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

    return res.status(200).json({
      message: '📄 جميع رموز الشحن الخاصة بالبائع',
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'فشل في جلب رموز الشحن',
      details: err.message,
    });
  }
};

/* ------------------------------------------------------------------
   7) استخدام رمز الشحن (للعميل)
------------------------------------------------------------------ */
exports.useRechargeCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) return res.status(400).json({ message: 'الرمز مطلوب' });

    const rechargeCode = await RechargeCode.findOne({ code });

    if (!rechargeCode)
      return res.status(404).json({ message: 'رمز الشحن غير موجود' });

    if (rechargeCode.isDisabled)
      return res
        .status(403)
        .json({ message: '❌ هذا الرمز تم تعطيله ولا يمكن استخدامه' });

    if (rechargeCode.isUsed)
      return res.status(400).json({ message: '❌ تم استخدام هذا الرمز مسبقاً' });

    if (rechargeCode.expiresAt && rechargeCode.expiresAt < new Date())
      return res.status(400).json({ message: '❌ انتهت صلاحية هذا الرمز' });

    // ✅ الحقل الصحيح في Wallet هو user وليس userId
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId, balance: 0 });
    }

    // زيادة الرصيد
    wallet.balance += rechargeCode.amount;
    await wallet.save();

    // وسم الرمز كمستخدم وتحديد المستخدم والتاريخ
    rechargeCode.isUsed = true;
    rechargeCode.usedBy = userId;
    rechargeCode.usedAt = new Date();
    await rechargeCode.save();

    // ✅ Transaction متوافقة مع enum (ابقينا الوصف كما هو)
    await Transaction.create({
      userId: userId,
      amount: rechargeCode.amount,
      type: 'credit',
      method: 'wallet',
      description: `شحن باستخدام الرمز ${rechargeCode.code}`,
    });

    return res.status(200).json({
      message: `✅ تم شحن رصيدك بمبلغ ${rechargeCode.amount} ل.س`,
      newBalance: wallet.balance,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'فشل استخدام الرمز', error: err.message });
  }
};

/* ------------------------------------------------------------------
   8) حذف/تعطيل رمز (منفصل عن الاستخدام)
------------------------------------------------------------------ */
exports.deleteRechargeCode = async (req, res) => {
  try {
    const { code } = req.params;
    const vendorId = req.user._id;

    const rechargeCode = await RechargeCode.findOne({ code, vendorId });

    if (!rechargeCode)
      return res
        .status(404)
        .json({ message: 'رمز الشحن غير موجود أو لا تملكه' });

    if (rechargeCode.isUsed)
      return res
        .status(400)
        .json({ message: '❌ لا يمكن حذف رمز تم استخدامه بالفعل' });

    rechargeCode.isDisabled = true;
    await rechargeCode.save();

    return res.status(200).json({
      message: '✅ تم تعطيل الرمز بنجاح. لم يعد قابلًا للاستخدام.',
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'فشل في تعطيل الرمز', error: err.message });
  }
};

/* ------------------------------------------------------------------
   9) تعطيل رمز الشحن فقط (منفصل عن الحذف)
------------------------------------------------------------------ */
exports.disableRechargeCode = async (req, res) => {
  try {
    const { code } = req.params;
    const vendorId = req.user._id;

    const rechargeCode = await RechargeCode.findOne({ code, vendorId });

    if (!rechargeCode)
      return res
        .status(404)
        .json({ message: 'رمز الشحن غير موجود أو لا تملكه' });

    if (rechargeCode.isDisabled)
      return res.status(400).json({ message: '❌ الرمز معطل مسبقًا' });

    if (rechargeCode.isUsed)
      return res
        .status(400)
        .json({ message: '❌ لا يمكن تعطيل رمز تم استخدامه' });

    rechargeCode.isDisabled = true;
    await rechargeCode.save();

    return res.status(200).json({ message: '✅ تم تعطيل الرمز بنجاح' });
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'فشل في تعطيل الرمز', error: err.message });
  }
};

/* ------------------------------------------------------------------
   10) توليد QR Code
------------------------------------------------------------------ */
exports.getRechargeCodeQR = async (req, res) => {
  try {
    const { code } = req.params;

    const rechargeCode = await RechargeCode.findOne({ code });

    if (!rechargeCode) {
      return res.status(404).json({ message: 'رمز الشحن غير موجود' });
    }

    const qrData = `Recharge Code: ${rechargeCode.code} - Amount: ${rechargeCode.amount} L.S`;
    const qrImage = await QRCode.toDataURL(qrData);

    return res.status(200).json({
      message: '✅ تم توليد صورة QR بنجاح',
      qrImage,
      code: rechargeCode.code,
      amount: rechargeCode.amount,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'فشل في توليد QR', error: err.message });
  }
};

/* ------------------------------------------------------------------
   11) جلب معاملات الشحن الخاصة بالبائع (مع Fallback)
------------------------------------------------------------------ */
exports.getRechargeTransactionsByVendor = async (req, res) => {
  try {
    const vendorId = req.user._id;

    // أكواد البائع المستخدمة + بيانات المستخدم
    const usedCodes = await RechargeCode.find({ vendorId, isUsed: true })
      .populate('usedBy', 'name phone phoneNumber')
      .sort({ usedAt: -1 })
      .lean();

    if (!usedCodes.length) {
      return res.status(200).json({
        message: '📄 معاملات الشحن عبر رموز هذا البائع',
        data: [],
      });
    }

    // الوصف المتوقع لكل كود
    const descriptions = usedCodes.map((c) => `شحن باستخدام الرمز ${c.code}`);

    // المعاملات المسجلة فعلاً (لو موجودة)
    const transactions = await Transaction.find({
      $or: [
        { description: { $in: descriptions } },
        { method: 'recharge-code', description: { $in: descriptions } }, // توافق قديم
      ],
    })
      .populate('userId', 'name phone phoneNumber')
      .sort({ createdAt: -1 })
      .lean();

    const mapUser = (u) =>
      u
        ? {
            name: u.name ?? null,
            phoneNumber: u.phone ?? u.phoneNumber ?? null,
          }
        : null;

    let data = [];
    if (transactions.length) {
      data = transactions.map((tx) => ({
        _id: tx._id,
        amount: tx.amount,
        type: tx.type,
        method: tx.method,
        description: tx.description,
        createdAt: tx.createdAt,
        user: mapUser(tx.userId),
      }));
    } else {
      // 🟢 Fallback: ابنِ المعاملات من الأكواد المستخدمة مباشرة
      data = usedCodes.map((c) => ({
        _id: c._id,
        amount: c.amount,
        type: 'credit',
        method: 'wallet',
        description: `شحن باستخدام الرمز ${c.code}`,
        createdAt: c.usedAt || c.updatedAt || c.createdAt,
        user: mapUser(c.usedBy),
      }));
    }

    return res.status(200).json({
      message: '📄 معاملات الشحن عبر رموز هذا البائع',
      data,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'فشل في جلب المعاملات الخاصة بالبائع',
      error: err.message,
    });
  }
};
