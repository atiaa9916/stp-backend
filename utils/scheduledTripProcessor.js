const cron = require('node-cron');
const Trip = require('../models/Trip');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const CommissionSettings = require('../models/CommissionSettings');

let isProcessing = false;

const processScheduledTrips = async () => {
  if (isProcessing) {
    console.log('🔄 المهمة السابقة لا تزال قيد التنفيذ. سيتم تخطي هذا الفحص.');
    return;
  }

  isProcessing = true;

  try {
    const now = new Date();

    const trips = await Trip.find({
      isScheduled: true,
      status: 'scheduled',
      scheduledDateTime: { $lte: now }
    });

    for (const trip of trips) {
      let commissionAmount = 0;

      const commissionSettings = await CommissionSettings.findOne({ isActive: true });
      if (!commissionSettings) {
        console.error(`❌ لا توجد إعدادات عمولة مفعّلة`);
        continue;
      }

      switch (commissionSettings.type) {
        case 'fixedPercentage':
          commissionAmount = (trip.fare * commissionSettings.value) / 100;
          break;
        case 'fixedAmount':
          commissionAmount = commissionSettings.value;
          break;
        case 'smartDynamic':
          commissionAmount = 0;
          break;
      }

      const driverWallet = await Wallet.findOne({ user: trip.driver });
      if (!driverWallet || driverWallet.balance < commissionAmount) {
        console.warn(`🚫 رصيد السائق غير كافٍ لرحلة ${trip._id}`);
        continue;
      }
      driverWallet.balance -= commissionAmount;
      await driverWallet.save();

      await Transaction.create({
        userId: trip.driver,
        type: 'debit',
        amount: commissionAmount,
        description: 'خصم عمولة رحلة مجدولة',
        method: 'wallet'
      });

      if (trip.paymentMethod === 'wallet') {
        const passengerWallet = await Wallet.findOne({ user: trip.passenger });
        if (!passengerWallet || passengerWallet.balance < trip.fare) {
          console.warn(`🚫 رصيد الراكب غير كافٍ لرحلة ${trip._id}`);
          continue;
        }
        passengerWallet.balance -= trip.fare;
        await passengerWallet.save();

        await Transaction.create({
          userId: trip.passenger,
          type: 'payment',
          amount: trip.fare,
          description: 'دفع أجرة رحلة مجدولة',
          method: 'wallet'
        });
      }

      trip.status = 'ready';
      trip.commissionAmount = commissionAmount;
      await trip.save();

      console.log(`✅ تم تنفيذ الرحلة المجدولة رقم ${trip._id}`);
    }
  } catch (error) {
    console.error('❌ خطأ أثناء معالجة الرحلات المجدولة:', error.message);
  } finally {
    isProcessing = false;
  }
};

// 💤 تم تعليق المهمة المجدولة مؤقتًا لتقليل الضغط أثناء التطوير
// إذا أردت تفعيلها، أزل التعليق التالي وحذف علامة$:
/*
cron.schedule('*$/2 * * * *', () => {
  console.log('⏱️ فحص الرحلات المجدولة...');
  processScheduledTrips();
});
*/

module.exports = processScheduledTrips;
