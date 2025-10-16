// tests/precharge.e2e.spec.js
const { auth } = require('./helpers');
const app = require('../app');

describe('PRECHARGE_WALLET=true flow', () => {
  let tokens;

  // دالة شحن عبر API لضمان إنشاء/تهيئة المحفظة بشكل صحيح
  const topupWithCode = async (agent, { amount, as = 'passenger' }) => {
    // 1) vendor ينشئ رمز
    const c1 = await auth(
      agent.post('/api/recharge/create-one'),
      tokens.vendor
    ).send({ amount }).set('Content-Type', 'application/json').expect(201);
    const code = c1.body?.data?.code;
    expect(code).toBeTruthy();

    // 2) المستخدم الهدف يستخدم الرمز
    const u1 = await auth(
      agent.post('/api/recharge/use'),
      tokens[as]
    ).send({ code }).set('Content-Type', 'application/json').expect(200);
    expect(u1.body).toHaveProperty('newBalance');
    return u1.body.newBalance;
  };

  beforeAll(async () => {
    process.env.PRECHARGE_WALLET = 'true';
    ({ tokens } = global.__TEST_CTX__);
  });

  afterAll(async () => {
    process.env.PRECHARGE_WALLET = 'false';
  });

  test('عند إنشاء رحلة wallet وغير مجدولة يتم الحجز مباشرةً (paid=true) ويخصم من محفظة الراكب بمقدار الأجرة', async () => {
    const agent = require('supertest')(app);

    // اعمل شحنًا مضمونًا عبر API (بدلاً من updateOne على الـDB)
    await topupWithCode(agent, { amount: 12000, as: 'passenger' });

    // رصيد قبل الإنشاء
    const { body: beforeBal } = await auth(agent.get('/api/wallet/balance'), tokens.passenger).expect(200);
    const start = beforeBal.balance;

    const fare = 3000;
    const body = {
      pickupLocation:  { type: 'Point', coordinates: [36.28, 33.52], address: 'A' },
      dropoffLocation:{ type: 'Point', coordinates: [36.31, 33.51], address: 'B' },
      fare,
      paymentMethod: 'wallet'
    };

    const { body: created } = await auth(agent.post('/api/trips'), tokens.passenger)
      .send(body)
      .expect(201);

    expect(created.trip).toBeDefined();
    expect(created.trip.paid).toBe(true);

    // رصيد بعد الإنشاء
    const { body: afterBal } = await auth(agent.get('/api/wallet/balance'), tokens.passenger).expect(200);
    const end = afterBal.balance;

    // تحقق أن الخصم يساوي الأجرة تمامًا
    expect(start - end).toBe(fare);
  });

  test('العمولة تُخصم من السائق عند completed (10%) مع بقاء trip.paid=true', async () => {
    const agent = require('supertest')(app);

    // تأكد من وجود رصيد جيد للراكب والسائق عبر API
    await topupWithCode(agent, { amount: 5000, as: 'passenger' });
    await topupWithCode(agent, { amount: 2000, as: 'driver' }); // لضمان عمولة كافية

    const fare = 2000;
    const body = {
      pickupLocation:  { type: 'Point', coordinates: [36.28, 33.52], address: 'A' },
      dropoffLocation:{ type: 'Point', coordinates: [36.31, 33.51], address: 'B' },
      fare,
      paymentMethod: 'wallet'
    };

    const { body: created } = await auth(agent.post('/api/trips'), tokens.passenger)
      .send(body)
      .expect(201);

    const id = created.trip._id;

    // تدفق الحالة
    await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'accepted' })
      .expect(200);
    await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'in_progress' })
      .expect(200);
    const { body: done } = await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'completed' })
      .expect(200);

    // 10% من 2000 = 200
    expect(done.trip.commissionAmount).toBe(200);
    expect(done.trip.paid).toBe(true);
  });
});
