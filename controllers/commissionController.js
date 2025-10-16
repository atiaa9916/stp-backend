// controllers/commissionController.js
const CommissionSettings = require('../models/CommissionSettings');

// ✅ Helper: sanitize & validate body
function normalizeBody(input = {}) {
  const out = {};

  // type
  const allowedTypes = ['fixedAmount', 'fixedPercentage', 'smartDynamic'];
  if (typeof input.type === 'string' && allowedTypes.includes(input.type)) {
    out.type = input.type;
  }

  // value
  if (input.value !== undefined) {
    const v = Number(input.value);
    if (!Number.isFinite(v) || v < 0) {
      throw new Error('القيمة value يجب أن تكون رقمًا ≥ 0');
    }
    if (out.type === 'fixedPercentage' && v > 100) {
      throw new Error('عند النوع fixedPercentage يجب أن تكون القيمة بين 0 و 100');
    }
    out.value = v;
  }

  // applies
  if (input.applies && typeof input.applies === 'object') {
    const applies = {};
    if (typeof input.applies.wallet === 'boolean') applies.wallet = input.applies.wallet;
    if (typeof input.applies.cash === 'boolean')   applies.cash   = input.applies.cash;
    if (Object.keys(applies).length) out.applies = applies;
  }

  // chargeStage
  const allowedStages = ['accepted', 'completed'];
  if (typeof input.chargeStage === 'string' && allowedStages.includes(input.chargeStage)) {
    out.chargeStage = input.chargeStage;
  }

  // isActive
  if (typeof input.isActive === 'boolean') {
    out.isActive = input.isActive;
  }

  // note
  if (typeof input.note === 'string') {
    out.note = input.note.trim() || null;
  }

  return out;
}

/**
 * GET /api/commission?scope=active|latest
 * - scope=active (افتراضي): يعيد الإعداد النشِط فقط؛ إن لم يوجد يُرجع 404
 * - scope=latest: يعيد أحدث إعداد تمّ حفظه حتى لو لم يكن نشِطًا؛ وإن لم يوجد يعيد افتراضيًا 200
 */
exports.getCommissionSettings = async (req, res) => {
  try {
    const scope = (req.query.scope || 'active').toLowerCase();

    if (scope === 'latest') {
      const latest = await CommissionSettings.findOne({}).sort({ updatedAt: -1, createdAt: -1 }).lean();
      if (!latest) {
        // لا توجد وثائق: أعِد افتراضيًا (ليس خطأ)
        return res.status(200).json({
          type: 'fixedAmount',
          value: 0,
          applies: { wallet: true, cash: false },
          chargeStage: 'completed',
          isActive: false,
          note: null,
          _id: null,
        });
      }
      return res.status(200).json(latest);
    }

    // scope = active
    const active = await CommissionSettings.findOne({ isActive: true }).lean();
    if (!active) {
      return res.status(404).json({ message: 'لا توجد إعدادات عمولة نشِطة حالياً' });
    }
    return res.status(200).json(active);
  } catch (error) {
    console.error('getCommissionSettings error:', error);
    return res.status(500).json({ error: 'فشل في جلب إعدادات العمولة' });
  }
};

/**
 * PUT /api/commission
 * body: { type, value, applies:{wallet?,cash?}, chargeStage, isActive?, note? }
 * السلوك:
 * - إن لم توجد وثيقة نشِطة: ينشئ وثيقة جديدة (isActive=true افتراضياً ما لم يُمرّر خلاف ذلك)
 * - إن وُجدت نشِطة: يُحدّثها بالقيم الجديدة
 * - إن طُلِب isActive=true: يتم إلغاء تفعيل جميع الوثائق الأخرى أولاً (singleton)
 * - إن طُلِب isActive=false: يسمح بتعطيل الإعداد الحالي (لن تبقى وثيقة نشِطة)
 */
exports.updateCommissionSettings = async (req, res) => {
  try {
    const patch = normalizeBody(req.body || {});

    // إذا حُدد النوع fixedPercentage بدون value صحيح لاحقاً ستسقط validation بالأعلى
    if (!patch.type && !patch.value && !patch.applies && !patch.chargeStage && typeof patch.isActive === 'undefined' && typeof patch.note === 'undefined') {
      return res.status(400).json({ error: 'لا توجد حقول صالحة للتحديث' });
    }

    // إن أراد تفعيل هذا الإعداد، عطّل الكل أولاً (لنضمن singleton نشِط)
    if (patch.isActive === true) {
      await CommissionSettings.updateMany({ isActive: true }, { $set: { isActive: false } });
    }

    // حاول إيجاد النشِط الحالي لتحديثه؛ وإن لم يوجد أنشئ جديدًا
    let settings = await CommissionSettings.findOne({ isActive: true });

    if (!settings) {
      // أنشئ وثيقة جديدة
      settings = new CommissionSettings({
        type: patch.type ?? 'fixedAmount',
        value: typeof patch.value === 'number' ? patch.value : 0,
        applies: {
          wallet: patch.applies?.wallet ?? true,
          cash:   patch.applies?.cash   ?? false,
        },
        chargeStage: patch.chargeStage ?? 'completed',
        isActive: typeof patch.isActive === 'boolean' ? patch.isActive : true,
        note: patch.note ?? null,
      });
    } else {
      // حدّث الوثيقة النشِطة
      if (patch.type)        settings.type = patch.type;
      if (typeof patch.value === 'number') settings.value = patch.value;
      if (patch.applies) {
        if (typeof patch.applies.wallet === 'boolean') settings.applies.wallet = patch.applies.wallet;
        if (typeof patch.applies.cash   === 'boolean') settings.applies.cash   = patch.applies.cash;
      }
      if (patch.chargeStage) settings.chargeStage = patch.chargeStage;
      if (typeof patch.isActive === 'boolean') settings.isActive = patch.isActive;
      if (typeof patch.note !== 'undefined')  settings.note = patch.note;
    }

    await settings.save();
    return res.status(200).json({ message: 'تم حفظ/تحديث إعدادات العمولة بنجاح', data: settings });
  } catch (error) {
    console.error('updateCommissionSettings error:', error);
    return res.status(500).json({ error: 'فشل في تحديث إعدادات العمولة', details: error.message });
  }
};
