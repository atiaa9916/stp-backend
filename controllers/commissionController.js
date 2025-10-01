const CommissionSettings = require('../models/CommissionSettings');

// 📄 جلب إعدادات العمولة
exports.getCommissionSettings = async (req, res) => {
  try {
    const settings = await CommissionSettings.findOne({ isActive: true });
    if (!settings) {
      return res.status(404).json({ message: 'لا توجد إعدادات عمولة حالياً' });
    }
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ error: 'فشل في جلب إعدادات العمولة' });
  }
};

// ✏️ تحديث أو إنشاء إعدادات العمولة
exports.updateCommissionSettings = async (req, res) => {
  const { type, value, note } = req.body;
  try {
    let settings = await CommissionSettings.findOne({ isActive: true });

    if (!settings) {
      settings = new CommissionSettings({ type, value, note });
    } else {
      settings.type = type;
      settings.value = value;
      settings.note = note;
    }

    await settings.save();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ error: 'فشل في تحديث إعدادات العمولة' });
  }
};
