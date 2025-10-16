// tests/transactions.e2e.spec.js
const { request, auth } = require('./helpers');

describe('Transactions listing', () => {
  let app, tokens;

  beforeAll(() => {
    app    = global.__APP__;
    tokens = global.__TEST_CTX__.tokens;
  });

  test('returns { value, Count } and includes wallet debit/credit entries', async () => {
    // quick trip to generate txs
    const createRes = await auth(request(app).post('/api/trips'), tokens.passenger)
      .send({
        pickupLocation:  { type: 'Point', coordinates: [36.2, 33.5], address: 'X' },
        dropoffLocation: { type: 'Point', coordinates: [36.21, 33.51], address: 'Y' },
        fare: 1000,
        paymentMethod: 'wallet'
      })
      .expect(201);
    const id = createRes.body.trip._id;
    await auth(request(app).patch(`/api/trips/${id}/status`), tokens.driver).send({ status: 'accepted' }).expect(200);
    await auth(request(app).patch(`/api/trips/${id}/status`), tokens.driver).send({ status: 'in_progress' }).expect(200);
    await auth(request(app).patch(`/api/trips/${id}/status`), tokens.driver).send({ status: 'completed' }).expect(200);

    // passenger tx
    const pTx = await auth(request(app).get('/api/transactions'), tokens.passenger).expect(200);
    expect(Array.isArray(pTx.body.value)).toBe(true);
    expect(typeof pTx.body.Count).toBe('number');
    expect(pTx.body.value.some(t => t.type === 'debit' && t.amount === 1000 && t.method === 'wallet')).toBe(true);

    // driver tx (commission 10% = 100)
    const dTx = await auth(request(app).get('/api/transactions'), tokens.driver).expect(200);
    expect(dTx.body.value.some(t => t.type === 'debit' && t.amount === 100 && t.method === 'wallet')).toBe(true);
  });
});
