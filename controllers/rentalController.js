// backend/controllers/rentalController.js
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// سرّ التوقيع — ضعه في .env
// RENTAL_QUOTE_SECRET=change_this_secret
const SECRET = process.env.RENTAL_QUOTE_SECRET || 'dev-secret-change-me';

// تسعير بسيط مبدئي (يمكنك نقله للقاعدة لاحقاً)
const PRICING = {
  economy: { basePerDay: 60000, deposit: 200000 },
  standard: { basePerDay: 90000, deposit: 300000 },
  suv: { basePerDay: 130000, deposit: 400000 },
};

function sign(payload) {
  const h = crypto.createHmac('sha256', SECRET);
  h.update(JSON.stringify(payload));
  return h.digest('hex');
}

exports.quote = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { city, from, to, carClass = 'economy' } = req.body || {};
    if (!city || !from || !to) return res.status(400).json({ message: 'بيانات ناقصة' });

    const cfg = PRICING[carClass] || PRICING.economy;
    const start = new Date(from);
    const end = new Date(to);
    if (!(start < end)) return res.status(400).json({ message: 'المدة غير صالحة' });

    // الأيام (على الأقل يوم واحد)
    const days = Math.max(1, Math.ceil((end - start) / (24 * 3600 * 1000)));

    const amount = cfg.basePerDay * days;
    const deposit = cfg.deposit;
    const quoteId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 دقيقة

    const payload = { quoteId, userId: String(userId || ''), amount, deposit, carClass, city, from: start.toISOString(), to: end.toISOString(), expiresAt: expiresAt.toISOString() };
    const signature = sign(payload);

    res.json({ data: { ...payload, signature } });
  } catch (err) {
    res.status(500).json({ message: 'فشل إنشاء عرض السعر', error: err.message });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const { quoteId, signature } = req.body || {};
    if (!quoteId || !signature) return res.status(400).json({ message: 'بيانات ناقصة' });

    // في الواقع ينبغي استرجاع الـ payload من التخزين/الذاكرة
    // هنا سنفترض أن العميل سيعيد نفس الحقول للتوثيق
    const payload = req.body.payload;
    if (!payload) return res.status(400).json({ message: 'payload مفقود' });

    const expected = sign(payload);
    if (expected !== signature) return res.status(400).json({ message: 'Signature غير صحيح' });
    if (new Date(payload.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'انتهت صلاحية العرض' });
    }

    // TODO: تنفيذ حجز مبلغ من المحفظة/البوابة (Escrow/Hold)
    // الآن: نحاكي نجاح الضمان
    res.json({ message: 'تم الضمان (محاكاة)', data: { escrowed: true } });
  } catch (err) {
    res.status(500).json({ message: 'فشل تأكيد الدفع/الضمان', error: err.message });
  }
};

exports.scheduleHandover = async (req, res) => {
  try {
    const { rentalId, when, where } = req.body || {};
    if (!when || !where?.lat || !where?.lng) return res.status(400).json({ message: 'موعد/موقع غير صالح' });
    // TODO: حفظ الجدولة في قاعدة البيانات
    res.json({ message: 'تمت جدولة التسليم (محاكاة)', data: { handoverAt: when, handoverLoc: where } });
  } catch (err) {
    res.status(500).json({ message: 'فشل جدولة التسليم', error: err.message });
  }
};
