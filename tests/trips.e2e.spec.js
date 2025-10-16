// tests/trips.e2e.spec.js
const { request, auth } = require('./helpers');

describe('Trips – wallet & cash flows', () => {
  let app, tokens, ids;

  beforeAll(() => {
    app    = global.__APP__;
    tokens = global.__TEST_CTX__.tokens;
    ids    = global.__TEST_CTX__.ids;
  });

  test('wallet (non-scheduled): no precharge on create; charge on completed; 10% commission', async () => {
    // 1) create wallet trip (no precharge)
    const body = {
      pickupLocation:  { type: 'Point', coordinates: [36.28, 33.52], address: 'A' },
      dropoffLocation: { type: 'Point', coordinates: [36.31, 33.51], address: 'B' },
      fare: 2000,
      paymentMethod: 'wallet'
    };
    const createRes = await auth(request(app).post('/api/trips'), tokens.passenger).send(body).expect(201);
    const tripId = createRes.body.trip._id;
    expect(createRes.body.trip.paid).toBe(false);

    // 2) driver accepts -> in_progress -> completed
    await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'accepted' }).expect(200);
    await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'in_progress' }).expect(200);
    const done = await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'completed' }).expect(200);

    expect(done.body.trip.paid).toBe(true);
    expect(done.body.trip.commissionAmount).toBe(200); // 10% of 2000
  });

  test('cash: paid=true on completed and no commission (cash applies=false)', async () => {
    const body = {
      pickupLocation:  { type: 'Point', coordinates: [36.28, 33.52], address: 'A' },
      dropoffLocation: { type: 'Point', coordinates: [36.31, 33.51], address: 'B' },
      fare: 5500,
      paymentMethod: 'cash'
    };
    const createRes = await auth(request(app).post('/api/trips'), tokens.passenger).send(body).expect(201);
    const tripId = createRes.body.trip._id;

    await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'accepted' }).expect(200);
    await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'in_progress' }).expect(200);
    const done = await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'completed' }).expect(200);

    expect(done.body.trip.paid).toBe(true);
    expect(done.body.trip.commissionAmount).toBe(0);
  });

  test('scheduled + wallet: charge at accepted (earliest), then completed with commission', async () => {
    const in10 = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const body = {
      pickupLocation:  { type: 'Point', coordinates: [36.28, 33.52], address: 'S1' },
      dropoffLocation: { type: 'Point', coordinates: [36.31, 33.51], address: 'S2' },
      fare: 2500,
      paymentMethod: 'wallet',
      isScheduled: true,
      scheduledDateTime: in10
    };
    const createRes = await auth(request(app).post('/api/trips'), tokens.passenger).send(body).expect(201);
    const tripId = createRes.body.trip._id;
    expect(createRes.body.trip.paid).toBe(false);

    // accept -> should charge passenger wallet now
    const acc = await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'accepted' }).expect(200);
    expect(acc.body.trip.paid).toBe(true);

    await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'in_progress' }).expect(200);
    const done = await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'completed' }).expect(200);
    expect(done.body.trip.commissionAmount).toBe(250); // 10%
  });

  test('idempotency by uniqueRequestId returns duplicated=true', async () => {
    const uid = 'test-uuid-1';
    const body = {
      pickupLocation:  { type: 'Point', coordinates: [36.28, 33.52], address: 'A' },
      dropoffLocation: { type: 'Point', coordinates: [36.31, 33.51], address: 'B' },
      fare: 1200,
      paymentMethod: 'wallet',
      uniqueRequestId: uid
    };
    const r1 = await auth(request(app).post('/api/trips'), tokens.passenger).send(body).expect(201);
    const r2 = await auth(request(app).post('/api/trips'), tokens.passenger).send(body).expect(200);
    expect(r2.body.duplicated).toBe(true);
    expect(r2.body.trip._id).toBe(r1.body.trip._id);
  });
});
