const request = require('supertest');

const BASE = process.env.API_BASE || 'http://localhost:5000';
const REQ  = () => request(BASE);

const TOKENS = {
  admin:     process.env.ADMIN_TOKEN,
  passenger: process.env.PASSENGER_TOKEN,
  driver:    process.env.DRIVER_TOKEN,
  vendor:    process.env.VENDOR_TOKEN,
};

const hasAllTokens = Object.values(TOKENS).every(Boolean);
const skipOrRun = hasAllTokens ? describe : describe.skip;

const withAuth = (req, role) =>
  req.set('Authorization', `Bearer ${TOKENS[role]}`);

const rnd = () => Math.random().toString(16).slice(2);

describe('Health', () => {
  it('server is up', async () => {
    const res = await REQ().get('/api/health');
    expect([200, 304]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('ok');
  });
});

// سنُشغِّل باقي الحزمة فقط لو التوكنات متوفرة
skipOrRun('E2E | Trips • Commission • Recharge', () => {
  const expectOk = (r) => expect([200,201]).toContain(r.statusCode);

  const setCommission = async ({ wallet=true, cash=false, value=10, chargeStage='completed', note='e2e' }) => {
    const res = await withAuth(
      REQ().put('/api/commission').send({
        type: 'fixedPercentage',
        value,
        applies: { wallet, cash },
        chargeStage,
        note,
      }),
      'admin'
    ).set('Content-Type','application/json');
    expectOk(res);
  };

  const topupWithCode = async ({ amount, as='passenger' }) => {
    // create code by vendor
    const c1 = await withAuth(
      REQ().post('/api/recharge/create-one').send({ amount }),
      'vendor'
    ).set('Content-Type','application/json');
    expectOk(c1);
    const code = c1.body?.data?.code;
    expect(code).toBeTruthy();

    // use by target user
    const u1 = await withAuth(
      REQ().post('/api/recharge/use').send({ code }),
      as
    ).set('Content-Type','application/json');
    expectOk(u1);
    expect(u1.body).toHaveProperty('newBalance');
    return u1.body.newBalance;
  };

  const getBalance = async (role) => {
    const r = await withAuth(REQ().get('/api/wallet/balance'), role);
    expectOk(r);
    return r.body.balance;
  };

  const createTrip = async ({ fare, paymentMethod='wallet', isScheduled=false, scheduledDateTime=null }) => {
    const body = {
      pickupLocation:  { type:'Point', coordinates:[36.28,33.52], address:'المزة' },
      dropoffLocation: { type:'Point', coordinates:[36.31,33.51], address:'البرامكة' },
      fare, paymentMethod, isScheduled
    };
    if (isScheduled && scheduledDateTime) body.scheduledDateTime = scheduledDateTime;

    const res = await withAuth(
      REQ().post('/api/trips').send(body),
      'passenger'
    ).set('Content-Type','application/json');
    expectOk(res);
    const id = res.body?.trip?._id;
    expect(id).toBeTruthy();
    return { id, trip: res.body.trip };
  };

  const setStatus = async (id, status, role='driver') => {
    const res = await withAuth(
      REQ().patch(`/api/trips/${id}/status`).send({ status }),
      role
    ).set('Content-Type','application/json');
    expectOk(res);
    return res.body.trip;
  };

  const getTx = async (role) => {
    const r = await withAuth(REQ().get('/api/transactions'), role);
    expectOk(r);
    return r.body;
  };

  beforeAll(async () => {
    // الوضع الافتراضي: عمولة 10% على المحفظة فقط، عند الإكمال
    await setCommission({ wallet:true, cash:false, value:10, chargeStage:'completed', note:`default-${rnd()}` });
  });

  it('Recharge code flow works', async () => {
    const b1 = await getBalance('passenger');
    const nb = await topupWithCode({ amount: 1500, as: 'passenger' });
    expect(nb).toBeGreaterThanOrEqual(b1 + 1500);
  });

  it('Wallet (non-scheduled): paid at completed + commission on driver', async () => {
    await setCommission({ wallet:true, cash:false, value:10, chargeStage:'completed', note:`wallet-only-${rnd()}` });

    // تأكد من رصيد الراكب كفاية
    await topupWithCode({ amount: 4000, as: 'passenger' });

    const startPax = await getBalance('passenger');
    const startDrv = await getBalance('driver');

    const { id } = await createTrip({ fare: 2000, paymentMethod:'wallet' });
    // accept -> in_progress -> completed
    await setStatus(id, 'accepted');
    await setStatus(id, 'in_progress');
    const done = await setStatus(id, 'completed');

    expect(done.paid).toBe(true);
    expect(done.commissionAmount).toBe(200); // 10%

    const endPax = await getBalance('passenger');
    const endDrv = await getBalance('driver');

    expect(startPax - endPax).toBe(2000);   // خُصمت الأجرة
    expect(startDrv - endDrv).toBe(200);    // انخصمت عمولة السائق

    const paxTx = await getTx('passenger');
    expect(paxTx.Count).toBeGreaterThan(0);
    const hasDebit = paxTx.value.some(v => v.type === 'debit' && v.amount === 2000 && /دفع أجرة رحلة/.test(v.description||v.desc||''));
    expect(hasDebit).toBe(true);

    const drvTx = await getTx('driver');
    const hasCommission = drvTx.value.some(v => v.type === 'debit' && v.amount === 200 && /عمولة منصة/.test(v.description||v.desc||''));
    expect(hasCommission).toBe(true);
  });

  it('Cash: paid=true at completed and NO commission when applies.cash=false', async () => {
    await setCommission({ wallet:true, cash:false, value:10, chargeStage:'completed', note:`cash-no-${rnd()}` });

    const { id } = await createTrip({ fare: 5500, paymentMethod:'cash' });
    await setStatus(id, 'accepted');
    await setStatus(id, 'in_progress');
    const done = await setStatus(id, 'completed');

    expect(done.paid).toBe(true);
    expect(done.commissionAmount).toBe(0);
  });

  it('Cash: commission applies when cash=true then revert', async () => {
    await setCommission({ wallet:true, cash:true, value:10, chargeStage:'completed', note:`cash-yes-${rnd()}` });

    const { id } = await createTrip({ fare: 5000, paymentMethod:'cash' });
    await setStatus(id, 'accepted');
    await setStatus(id, 'in_progress');
    const done = await setStatus(id, 'completed');

    expect(done.paid).toBe(true);
    expect(done.commissionAmount).toBe(500);

    // رجع للوضع الافتراضي
    await setCommission({ wallet:true, cash:false, value:10, chargeStage:'completed', note:`reset-${rnd()}` });
  });

  it('Scheduled wallet: precharge at ACCEPTED, refund on CANCEL when chargeStage=accepted', async () => {
    // اضمن رصيدًا كافيًا
    await topupWithCode({ amount: 2500, as: 'passenger' });

    // شغّل تحصيل العمولة عند القبول
    await setCommission({ wallet:true, cash:false, value:10, chargeStage:'accepted', note:`accepted-${rnd()}` });

    const in10 = new Date(Date.now() + 10*60*1000).toISOString();
    const { id } = await createTrip({ fare: 1800, paymentMethod:'wallet', isScheduled:true, scheduledDateTime: in10 });

    const paxBefore = await getBalance('passenger');
    const drvBefore = await getBalance('driver');

    const acc = await setStatus(id, 'accepted');
    expect(acc.paid).toBe(true); // تم خصم الأجرة عند القبول (مجدولة+محفظة)
    // ألغِ بعد القبول
    const cancelRes = await setStatus(id, 'cancelled');
    expect(cancelRes.paid).toBe(false);
    expect(cancelRes.commissionAmount).toBe(0);

    const paxAfter = await getBalance('passenger');
    const drvAfter = await getBalance('driver');

    // استرداد الراكب للأجرة
    expect(paxAfter).toBeGreaterThanOrEqual(paxBefore);
    // رد عمولة السائق (إن كانت خُصمت بالقبول)
    expect(drvAfter).toBeGreaterThanOrEqual(drvBefore);

    // رجّع سياسة العمولة للوضع الافتراضي
    await setCommission({ wallet:true, cash:false, value:10, chargeStage:'completed', note:`reset2-${rnd()}` });
  });

  it('Vendor recharge transactions endpoint returns list (fallback-safe)', async () => {
    // أنشئ واستخدم رمزًا ليظهر في تقارير البائع
    await topupWithCode({ amount: 1000, as: 'passenger' });

    const r = await withAuth(
      REQ().get('/api/recharge/vendor-transactions'),
      'vendor'
    );
    expectOk(r);
    expect(Array.isArray(r.body.data)).toBe(true);
  });
});
