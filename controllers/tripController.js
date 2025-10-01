// 📂 controllers/tripController.js 

// ====== Imports ======
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const Trip = require('../models/Trip');
const Wallet = require('../models/Wallet');
const CommissionSettings = require('../models/CommissionSettings');
const Transaction = require('../models/Transaction');
const TripAcceptanceLog = require('../models/TripAcceptanceLog');
const Setting = require('../models/Setting');

// ====== بيئة قابلة للتهيئة ======
const COMMISSION_CHARGE_STAGE = (process.env.COMMISSION_CHARGE_STAGE || 'completed').toLowerCase(); // 'accepted' | 'completed'
const VALID_PAYMENT_METHODS = ['cash', 'wallet', 'bank'];

// تطبيع أماكن الانطلاق/الوجهة إلى شكل موحد { address, lat, lng, location:{type:'Point',coordinates:[lng,lat]} }
function normalizePickupDropoff(body) {
  const normPoint = (o) => {
    if (!o) return null;
    // GeoJSON
    if (o.location?.type === 'Point' && Array.isArray(o.location.coordinates)) {
      const [lng, lat] = o.location.coordinates.map(Number);
      return {
        address: o.address || o.label || o.name || '',
        lat, lng,
        location: { type: 'Point', coordinates: [lng, lat] }
      };
    }
    // lat/lng مباشرة
    if (o.lat != null && o.lng != null) {
      const lat = Number(o.lat), lng = Number(o.lng);
      return {
        address: o.address || '',
        lat, lng,
        location: { type: 'Point', coordinates: [lng, lat] }
      };
    }
    return null;
  };

  const pickCands = [
    body.pickup, body.origin, body.start, body.from,
    body.pickupLocation ? { location: body.pickupLocation, address: body.pickupAddress } : null,
    (body.pickupLat != null && body.pickupLng != null) ? { lat: body.pickupLat, lng: body.pickupLng, address: body.pickupAddress } : null,
  ].filter(Boolean);

  const dropCands = [
    body.dropoff, body.destination, body.end, body.to,
    body.destinationLocation ? { location: body.destinationLocation, address: body.dropoffAddress || body.destinationAddress } : null,
    (body.dropoffLat != null && body.dropoffLng != null) ? { lat: body.dropoffLat, lng: body.dropoffLng, address: body.dropoffAddress } : null,
  ].filter(Boolean);

  const pickup  = pickCands.map(normPoint).find(Boolean)  || null;
  const dropoff = dropCands.map(normPoint).find(Boolean) || null;
  return { pickup, dropoff };
}


// ====== Helpers ======
function assert(condition, msg, status = 400) {
  if (!condition) {
    const e = new Error(msg);
    e.statusCode = status;
    throw e;
  }
}
const isAdmin     = (u) => !!(u && (u.role === 'admin' || u.isAdmin));
const isDriver    = (u) => !!(u && (u.role === 'driver'));
const isPassenger = (u) => !!(u && (u.role === 'passenger'));

function normalizeFromEnv() {
  const model = String(process.env.COMMISSION_MODEL || 'flat').toLowerCase();
  const applies = { wallet: true, cash: String(process.env.CASH_COMMISSION_APPLIES||'false').toLowerCase()==='true' };
  const chargeStage = String(process.env.COMMISSION_CHARGE_STAGE || 'completed').toLowerCase();
  if (model === 'percent') {
    return { type: 'fixedPercentage', value: Number(process.env.COMMISSION_PERCENT || 0), applies, chargeStage, isActive: true };
  }
  return { type: 'fixedAmount', value: Number(process.env.COMMISSION_FLAT || 0), applies, chargeStage, isActive: true };
}

function asObjectId(id) { try { return new mongoose.Types.ObjectId(id); } catch { return null; } }

async function getActiveCommission() {
  // 1) commissionsettings
  const cs = await CommissionSettings.findOne({ isActive: true }).lean();
  if (cs) return cs;

  // 2) settings:key=commission
  const s = await Setting.findOne({ key: 'commission' }).lean();
  if (s && s.isActive !== false) {
    if (String(s.model||'').toLowerCase()==='percent')
      return { type:'fixedPercentage', value: Number(s.percent||0), applies:s.applies||{wallet:true,cash:false}, chargeStage: s.chargeStage||'completed', isActive:true };
    return { type:'fixedAmount', value: Number(s.value||0), applies:s.applies||{wallet:true,cash:false}, chargeStage: s.chargeStage||'completed', isActive:true };
  }

  // 3) env
  return normalizeFromEnv();
}

function calcCommissionAmount(fare, settings) {
  if (!settings) return 0;
  switch (settings.type) {
    case 'fixedPercentage': return Math.max(0, (fare * settings.value) / 100);
    case 'fixedAmount':     return Math.max(0, settings.value);
    case 'smartDynamic':    return 0; // لاحقًا
    default:                return 0;
  }
}

// اسم موحّد لاستخدامه في كلّ مكان
function findWallet(userId, session) {
  return Wallet.findOne({
    $or: [{ userId: userId }, { user: userId }]
  }).session(session || null);
}

// نسجل userId و user معًا لتوافق كل الإصدارات من الـ Schema
async function addTx({ userId, type, amount, description, method }, session) {
  return Transaction.create(
    [{ userId, user: userId, type, amount, desc: description, method }],
    { session }
  );
}

// ====== منطق مالي ذري (بجلسة) ======

// خصم أجرة من محفظة الراكب (wallet) — يرجع الرصيد الجديد
async function chargePassengerWallet({ passengerId, amount, method }, session) {
  assert(method === 'wallet', 'طريقة الدفع ليست محفظة', 400);
  assert(amount > 0, 'المبلغ غير صالح', 400);

  const pw = await findWallet(passengerId, session);
  assert(pw && pw.balance >= amount, 'الرصيد غير كافٍ في محفظة الراكب أو لا توجد محفظة');

  pw.balance -= amount;
  await pw.save({ session });
  await addTx({
    userId: passengerId,
    type: 'debit', // خصم من محفظة الراكب
    amount,
    description: 'دفع أجرة رحلة من المحفظة',
    method: 'wallet',
  }, session);

  return { ok: true, newBalance: pw.balance };
}

// رد مبلغ للراكب — يرجع الرصيد الجديد
async function refundPassengerWallet({ passengerId, amount }, session) {
  if (!amount || amount <= 0) return { ok: false, newBalance: null };
  const pw = await findWallet(passengerId, session);
  if (!pw) return { ok: false, newBalance: null };

  pw.balance += amount;
  await pw.save({ session });
  await addTx({
    userId: passengerId,
    type: 'credit', // استرداد إلى محفظة الراكب
    amount,
    description: 'استرداد أجرة رحلة ملغاة',
    method: 'wallet',
  }, session);

  return { ok: true, newBalance: pw.balance };
}

// خصم عمولة من محفظة السائق — يرجع قيمة العمولة المخصومة
async function chargeDriverCommission({ driverId, fare }, session) {
  const settings = await getActiveCommission();
  assert(settings, 'إعدادات العمولة غير موجودة، الرجاء إدخالها أولاً', 500);

  const commissionAmount = calcCommissionAmount(fare, settings);
  if (commissionAmount > 0) {
    const dw = await findWallet(driverId, session);
    assert(dw && dw.balance >= commissionAmount, 'رصيد السائق غير كافٍ لدفع العمولة أو لا توجد محفظة');

    dw.balance -= commissionAmount;
    await dw.save({ session });
    await addTx({
      userId: driverId,
      type: 'debit', // خصم من محفظة السائق
      amount: commissionAmount,
      description: 'خصم عمولة منصة عن رحلة',
      method: 'wallet',
    }, session);
  }
  return commissionAmount || 0;
}

async function refundDriverCommission({ driverId, amount }, session) {
  if (!amount || amount <= 0) return;
  const dw = await findWallet(driverId, session);
  if (!dw) return;
  dw.balance += amount;
  await dw.save({ session });
  await addTx({
    userId: driverId,
    type: 'credit', // رد إلى محفظة السائق
    amount,
    description: 'رد عمولة لرحلة ملغاة',
    method: 'wallet',
  }, session);
}

// ====== Controllers ======

/**
 * إنشاء رحلة مع idempotency
 * سياسة الدفع:
 *  - wallet + غير مجدولة ⇒ خصم فوري عند الإنشاء.
 *  - wallet + مجدولة ⇒ الخصم عند ready/accepted (أيهما أولًا).
 *  - cash/bank ⇒ paid=false حتى الإكمال/نجاح البوابة.
 */
exports.createTrip = async (req, res) => {
  let session;
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    let {
      pickupLocation,
      dropoffLocation,
      fare,
      paymentMethod = 'cash',
      driverId,              // اختياري
      isScheduled = false,
      scheduledDateTime,     // ISO
      uniqueRequestId
    } = req.body || {};

    // ← تطبيع أي صيغة واردة (pickup/dropoff | origin/destination | start/end | flat lat/lng ...)
      if (!pickupLocation || !dropoffLocation) {
        const { pickup, dropoff } = normalizePickupDropoff(req.body || {});
        pickupLocation  = pickupLocation  || pickup?.location  || null;
        dropoffLocation = dropoffLocation || dropoff?.location || null;
        req.body.pickupLocation  = pickupLocation;
        req.body.dropoffLocation = dropoffLocation;
      }

    // تحقق مدخلات
    assert(pickupLocation && dropoffLocation, 'يجب تحديد مكان الانطلاق والوجهة');
    assert(typeof fare === 'number' && fare > 0, 'الأجرة غير صالحة');
    assert(VALID_PAYMENT_METHODS.includes(paymentMethod), 'طريقة الدفع غير مدعومة');

    if (isScheduled) {
      assert(scheduledDateTime, 'لا يوجد وقت مجدول');
      assert(new Date(scheduledDateTime).getTime() > Date.now(), 'وقت الجدولة يجب أن يكون مستقبليًا');
    }

    // idempotency
    const finalRequestId = uniqueRequestId || uuidv4();
    if (finalRequestId) {
      const existing = await Trip.findOne({ uniqueRequestId: finalRequestId }).lean();
      if (existing) {
        return res.status(200).json({ trip: existing, duplicated: true });
      }
    }

    session = await mongoose.startSession();

    let created;
    let paxNewBalance = null; // ← لنُعيده للفرونت
    await session.withTransaction(async () => {
      const status = isScheduled ? 'scheduled' : 'pending';
      let commissionAmount = 0;
      let paid = false;

      // خصم فوري فقط لو غير مجدولة + wallet
      if (!isScheduled && paymentMethod === 'wallet') {
        const paidRes = await chargePassengerWallet({
          passengerId: user._id,
          amount: fare,
          method: 'wallet',
        }, session);
        paid = !!paidRes?.ok;
        paxNewBalance = paidRes?.newBalance ?? null;
      }

      const [doc] = await Trip.create([{
        passenger: user._id,
        driver: driverId || undefined,
        pickupLocation,
        dropoffLocation,
        fare,
        paymentMethod,
        commissionAmount,                 // تُخصم لاحقًا حسب السياسة
        isScheduled: !!isScheduled,
        scheduledDateTime: isScheduled ? new Date(scheduledDateTime) : undefined,
        status,
        uniqueRequestId: finalRequestId,
        paid,
      }], { session });

      created = doc;
    });

    return res.status(201).json({
      trip: created,
      ...(paxNewBalance != null ? { walletBalance: paxNewBalance } : {})
    });
  } catch (err) {
    console.error('createTrip error:', err);
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.uniqueRequestId) {
      return res.status(409).json({ message: 'duplicate uniqueRequestId' });
    }
    return res.status(err.statusCode || 500).json({ message: 'فشل إنشاء الرحلة', error: err.message });
  } finally {
    if (session) await session.endSession();
  }
};

/**
 * رحلات المستخدم الحالي
 */
exports.getTripsByUser = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      status
    } = req.query;

    const q = {};
    if (isDriver(user)) q.driver = user._id;
    else q.passenger = user._id;

    if (status) q.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Trip.find(q).sort(String(sort)).skip(skip).limit(Number(limit)),
      Trip.countDocuments(q),
    ]);

    return res.json({
      items,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1
    });
  } catch (err) {
    console.error('getTripsByUser error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * تحديث حالة الرحلة + الخصومات/الاستردادات وفق السياسة
 */
exports.updateTripStatus = async (req, res) => {
  let session;
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;


    let { status } = req.body || {};
    assert(status, 'status مطلوب');

    // توحيد أسماء الحالات الواردة
    const mapStatus = (s='') => {
      s = String(s).toLowerCase();
      if (['in_progress','inprogress','started','start'].includes(s)) return 'in_progress';
      if (['accepted','accept'].includes(s)) return 'accepted';
      if (['completed','complete','done'].includes(s)) return 'completed';
      if (['cancelled','canceled','cancel'].includes(s)) return 'cancelled';
      return s;
    };
    status = mapStatus(status);

    const allowed = ['scheduled','ready','pending','accepted','in_progress','completed','cancelled'];
    assert(allowed.includes(status), 'حالة غير مدعومة', 400);

    const trip = await Trip.findById(id);

    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const current = trip.status;
    const isTripDriver = trip.driver && String(trip.driver) === String(user._id);
    const isTripPassenger = String(trip.passenger) === String(user._id);
    
    // صلاحيات وانتقالات
    if (!isAdmin(user)) {
      if (isDriver(user)) {
        if (status === 'accepted') {
          assert(['pending','ready','scheduled'].includes(current), 'لا يمكن قبول هذه الرحلة');
          trip.driver = user._id; // يسنِد نفسه
        } else if (status === 'in_progress') {
          assert(current === 'accepted' && isTripDriver, 'غير مصرح ببدء الرحلة');
        } else if (status === 'completed') {
          assert(current === 'in_progress' && isTripDriver, 'غير مصرح بإكمال الرحلة');
        } else if (status === 'cancelled') {
          assert(isTripDriver && ['accepted'].includes(current), 'لا يمكنك إلغاء هذه الرحلة');
        } else if (status === 'ready') {
          assert(isTripDriver, 'غير مصرح بتعيين ready');
        } else {
          return res.status(403).json({ message: 'انتقال غير مسموح للسائق' });
        }
      } else if (isPassenger(user)) {
        if (status === 'cancelled') {
          assert(isTripPassenger, 'هذه ليست رحلتك');
          assert(['pending','accepted','scheduled','ready'].includes(current), 'لا يمكن الإلغاء الآن');
        } else {
          return res.status(403).json({ message: 'انتقال غير مسموح للراكب' });
        }
      } else {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    session = await mongoose.startSession();
    let updated;
    let paxNewBalance = null;
    let drvNewBalance = null;

    await session.withTransaction(async () => {
      // للرحلات المجدولة + wallet: خصم عند ready/accepted (الأسبق)
      if (trip.isScheduled && trip.paymentMethod === 'wallet' && !trip.paid &&
          (status === 'ready' || status === 'accepted')) {
        const paidRes = await chargePassengerWallet({
          passengerId: trip.passenger,
          amount: trip.fare,
          method: 'wallet',
        }, session);
        if (paidRes?.ok) {
          trip.paid = true;
          paxNewBalance = paidRes.newBalance;
        }
      }

      // سجل القبول + عمولة مبكرة لو السياسة accepted
      if (status === 'accepted') {
        await TripAcceptanceLog.create([{ driverId: trip.driver || user._id, tripId: trip._id }], { session });

        if (COMMISSION_CHARGE_STAGE === 'accepted' && trip.commissionAmount === 0) {
          assert(trip.driver, 'لا يمكن خصم عمولة بدون سائق');
          const amt = await chargeDriverCommission({ driverId: trip.driver, fare: trip.fare }, session);
          trip.commissionAmount = amt;
        }
      }

      // دفع نقدي يعتبر مدفوعًا عند الإكمال
      if (status === 'completed' && trip.paymentMethod === 'cash') {
        trip.paid = true;
      }

      // عمولة عند الإكمال لو السياسة completed
      if (status === 'completed' && COMMISSION_CHARGE_STAGE === 'completed' && trip.commissionAmount === 0) {
        assert(trip.driver, 'لا يمكن خصم عمولة بدون سائق');
        const amt = await chargeDriverCommission({ driverId: trip.driver, fare: trip.fare }, session);
        trip.commissionAmount = amt;
      }

      // استردادات عند الإلغاء
      if (status === 'cancelled') {
        if (trip.paymentMethod === 'wallet' && trip.paid && trip.fare > 0) {
          const refundRes = await refundPassengerWallet({
            passengerId: trip.passenger,
            amount: trip.fare
          }, session);
          if (refundRes?.ok) paxNewBalance = refundRes.newBalance;
          trip.paid = false;
        }
        if (trip.commissionAmount > 0 && trip.driver) {
          await refundDriverCommission({ driverId: trip.driver, amount: trip.commissionAmount }, session);
          trip.commissionAmount = 0;
        }
      }

      // احسب رصيد السائق بعد أي خصم/رد عمولة
      if (trip.driver) {
        const dWallet = await findWallet(trip.driver, session);
        drvNewBalance = dWallet?.balance ?? null;
      }

      trip.status = status;
      updated = await trip.save({ session });
    });

    return res.json({
      trip: updated,
      ...(paxNewBalance != null ? { walletBalance: paxNewBalance } : {}),
      ...(drvNewBalance != null ? { driverWalletBalance: drvNewBalance } : {}),
    });
  } catch (err) {
    console.error('updateTripStatus error:', err);
    return res.status(err.statusCode || 500).json({ message: 'Server error', error: err.message });
  } finally {
    if (session) await session.endSession();
  }
};

/**
 * فلترة عامة
 */
exports.getTripsByFilter = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const {
      passengerId,
      driverId,
      status,
      paymentMethod,
      paid,
      isScheduled,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query;

    const q = {};

    if (passengerId) {
      const oid = asObjectId(passengerId);
      assert(oid, 'passengerId غير صالح');
      q.passenger = oid;
    }
    if (driverId) {
      const oid = asObjectId(driverId);
      assert(oid, 'driverId غير صالح');
      q.driver = oid;
    }
    if (status) q.status = status;
    if (paymentMethod) q.paymentMethod = paymentMethod;
    if (paid === 'true') q.paid = true;
    if (paid === 'false') q.paid = false;
    if (isScheduled === 'true') q.isScheduled = true;
    if (isScheduled === 'false') q.isScheduled = false;

    if (fromDate || toDate) {
      q.createdAt = {};
      if (fromDate) q.createdAt.$gte = new Date(fromDate);
      if (toDate)   q.createdAt.$lte = new Date(toDate);
    }

    if (!isAdmin(user)) {
      if (isDriver(user)) q.driver = user._id;
      else q.passenger = user._id;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Trip.find(q).sort(String(sort)).skip(skip).limit(Number(limit)),
      Trip.countDocuments(q)
    ]);

    return res.json({
      items,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      query: q
    });
  } catch (err) {
    console.error('getTripsByFilter error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.cancelTrip = async (req,res,next)=>{
  try { req.body = req.body || {}; req.body.status='cancelled'; 
        return exports.updateTripStatus(req,res,next); } 
  catch(e){ next(e); }
};
