const path = require('path');
const fs = require('fs');
const PaymentRequest = require('../models/PaymentRequest');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction'); // موجود لديك
// ملاحظة: Wallet لديك حقله user (وليس userId)

exports.createShamCashRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, transactionId } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({ message: 'المبلغ غير صالح' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'إرفاق إيصال التحويل مطلوب' });
    }

    const pr = await PaymentRequest.create({
      user: userId,
      amount,
      method: 'shamcash',
      status: 'pending',
      transactionId: transactionId || null,
      proofImage: `/uploads/shamcash/${req.file.filename}`
    });

    return res.status(201).json({
      message: 'تم إرسال طلب الشحن لمراجعة الإدارة',
      data: pr
    });
  } catch (err) {
    console.error('createShamCashRequest error:', err);
    return res.status(500).json({ message: 'فشل إنشاء طلب الشحن', error: err.message });
  }
};

exports.getMyPaymentRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const list = await PaymentRequest.find({ user: userId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'فشل في جلب الطلبات', error: err.message });
  }
};

// موافقة الإدارة على طلب الشحن (تضيف الرصيد)
exports.approvePaymentRequest = async (req, res) => {
  try {
    const { id } = req.params; // PaymentRequest._id
    const pr = await PaymentRequest.findById(id);
    if (!pr) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (pr.status !== 'pending') {
      return res.status(409).json({ message: 'لا يمكن تعديل حالة طلب غير معلق' });
    }

    // أضف إلى المحفظة
    let wallet = await Wallet.findOne({ user: pr.user });
    if (!wallet) wallet = await Wallet.create({ user: pr.user, balance: 0 });
    wallet.balance += pr.amount;
    await wallet.save();

    // معاملة
    await Transaction.create({
      userId: pr.user,
      amount: pr.amount,
      type: 'recharge',
      method: 'shamCash',
      description: `شحن شام كاش (طلب ${pr._id})`
    });

    pr.status = 'approved';
    await pr.save();

    res.json({ message: 'تمت الموافقة وإضافة الرصيد', newBalance: wallet.balance });
  } catch (err) {
    res.status(500).json({ message: 'فشل الموافقة على الطلب', error: err.message });
  }
};

exports.rejectPaymentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body || {};
    const pr = await PaymentRequest.findById(id);
    if (!pr) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (pr.status !== 'pending') {
      return res.status(409).json({ message: 'لا يمكن تعديل حالة طلب غير معلق' });
    }
    pr.status = 'rejected';
    pr.adminNotes = adminNotes || null;
    await pr.save();
    res.json({ message: 'تم رفض الطلب' });
  } catch (err) {
    res.status(500).json({ message: 'فشل رفض الطلب', error: err.message });
  }
};

// مبدئيًا: بدء جلسة دفع فيزا (placeholder)
// لاحقًا سنربطه ببوابة دفع حقيقية ونضيف Webhook
exports.createVisaSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;
    if (!amount || amount < 1000) {
      return res.status(400).json({ message: 'المبلغ غير صالح' });
    }
    // هنا عادة نستدعي مزوّد الدفع ونرجع sessionUrl
    // مؤقتًا نرجّع رابطًا وهميًا
    return res.json({
      message: 'تم إنشاء جلسة دفع تجريبية',
      sessionUrl: 'https://example.com/pay/visa/sandbox'
    });
  } catch (err) {
    res.status(500).json({ message: 'فشل بدء عملية الدفع', error: err.message });
  }
};
