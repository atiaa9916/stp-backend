// tests/cancellations.e2e.spec.js
const { request, auth } = require('./helpers');

describe('Cancellations & refunds', () => {
  let app, tokens;

  beforeAll(() => {
    app    = global.__APP__;
    tokens = global.__TEST_CTX__.tokens;
  });

  test('scheduled wallet trip: charge at accepted then cancel -> refund passenger; no commission remains', async () => {
    const in15 = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const body = {
      pickupLocation:  { type: 'Point', coordinates: [36.29, 33.52], address: 'S1' },
      dropoffLocation: { type: 'Point', coordinates: [36.32, 33.52], address: 'S2' },
      fare: 1800,
      paymentMethod: 'wallet',
      isScheduled: true,
      scheduledDateTime: in15
    };

    const createRes = await auth(request(app).post('/api/trips'), tokens.passenger).send(body).expect(201);
    const tripId = createRes.body.trip._id;

    // accept => wallet charged, paid=true
    const acc = await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'accepted' }).expect(200);
    expect(acc.body.trip.paid).toBe(true);

    // cancel by driver allowed only from accepted
    const can = await auth(request(app).patch(`/api/trips/${tripId}/status`), tokens.driver).send({ status: 'cancelled' }).expect(200);
    expect(can.body.trip.paid).toBe(false);               // refunded
    expect(can.body.trip.commissionAmount).toBe(0);       // any commission refunded
    expect(can.body.driverWalletBalance).toBeDefined();   // driver wallet after refund (unchanged or restored)
  });
});
