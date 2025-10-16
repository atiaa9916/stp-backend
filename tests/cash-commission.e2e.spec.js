// tests/cash-commission.e2e.spec.js
const app = require('../app');
const { request, auth } = require('./helpers');
const CommissionSettings = require('../models/CommissionSettings');

describe('Cash commission applies=true', () => {
  let tokens;
  beforeAll(async () => {
    tokens = global.__TEST_CTX__.tokens;
    // فعّل عمولة الكاش = true
    await CommissionSettings.updateMany({}, { $set: { applies: { wallet: true, cash: true }, chargeStage:'completed', isActive:true } });
  });

  afterAll(async () => {
    // نُعيد الإعداد الافتراضي
    await CommissionSettings.updateMany({}, { $set: { applies: { wallet: true, cash: false }, chargeStage:'completed', isActive:true } });
  });

  test('رحلة كاش تحتسب عمولة عند completed', async () => {
    const agent = require('supertest')(app);
    const { body: created } = await auth(agent.post('/api/trips'), tokens.passenger)
      .send({
        pickupLocation:{ type:'Point', coordinates:[36.28,33.52] },
        dropoffLocation:{ type:'Point', coordinates:[36.31,33.51] },
        fare: 6000,
        paymentMethod: 'cash'
      }).expect(201);

    const id = created.trip._id;
    await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver).send({ status:'accepted' }).expect(200);
    await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver).send({ status:'in_progress' }).expect(200);
    const { body: done } = await auth(agent.patch(`/api/trips/${id}/status`), tokens.driver)
      .send({ status:'completed' }).expect(200);

    expect(done.trip.paid).toBe(true);
    expect(done.trip.commissionAmount).toBe(600); // 10%
  });
});
