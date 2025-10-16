// tests/errors.e2e.spec.js
const app = require('../app');
const { request, auth } = require('./helpers');
const Wallet = require('../models/Wallet');

describe('Error cases: insufficient balances', () => {
  let tokens, ids;
  beforeAll(async () => {
    ({ tokens, ids } = global.__TEST_CTX__);
  });

  test('محفظة راكب غير كافية: إكمال رحلة wallet بدون رصيد كافٍ يُرجع خطأ', async () => {
    const agent = require('supertest')(app);
    // صفر رصيد الراكب
    await Wallet.updateOne(
      { user: ids.passenger },
      { $set: { balance: 0 } },
      { upsert: true }
    );

    const { body: created } = await auth(agent.post('/api/trips'), tokens.passenger)
      .send({
        pickupLocation:  { type: 'Point', coordinates: [36.27, 33.51] },
        dropoffLocation: { type: 'Point', coordinates: [36.30, 33.51] },
        fare: 1500,
        paymentMethod: 'wallet'
      })
      .expect(201);

    const id = created.trip._id;

    // التسلسل الصحيح: accepted -> in_progress -> completed
    await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'accepted' })
      .expect(200);

    await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'in_progress' })
      .expect(200);

    // مع PRECHARGE=false سيتم الخصم عند completed -> يجب أن يفشل بسبب رصيد الراكب
    const res = await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'completed' })
      .expect(400);

    expect(res.body.error || res.body.message).toMatch(/الرصيد غير كافٍ/i);
  });

  test('محفظة سائق غير كافية للعمولة: عند completed تُرفض العملية برسالة مناسبة', async () => {
    const agent = require('supertest')(app);

    // ثبّت رصيد الراكب ليكفي خصم الأجرة، وصفّر رصيد السائق لاختبار العمولة
    await Wallet.updateOne(
      { user: ids.passenger },
      { $set: { balance: 10000 } },
      { upsert: true }
    );
    await Wallet.updateOne(
      { user: ids.driver },
      { $set: { balance: 0 } },
      { upsert: true }
    );

    const { body: created } = await auth(agent.post('/api/trips'), tokens.passenger)
      .send({
        pickupLocation:  { type: 'Point', coordinates: [36.27, 33.51] },
        dropoffLocation: { type: 'Point', coordinates: [36.30, 33.51] },
        fare: 2000,
        paymentMethod: 'wallet'
      })
      .expect(201);

    const id = created.trip._id;

    // التسلسل الصحيح
    await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'accepted' })
      .expect(200);

    await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'in_progress' })
      .expect(200);

    // الآن سيفشل عند محاولة خصم عمولة السائق (10% = 200) بسبب رصيده 0
    const res = await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status: 'completed' })
      .expect(400);

    expect(res.body.error || res.body.message).toMatch(/رصيد السائق غير كافٍ/i);
  });
});
