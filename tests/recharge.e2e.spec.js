// tests/recharge.e2e.spec.js
const { request, auth } = require('./helpers');

describe('Recharge Codes', () => {
  let app, tokens;

  beforeAll(() => {
    app    = global.__APP__;
    tokens = global.__TEST_CTX__.tokens;
  });

  test('vendor creates one code, passenger redeems, vendor sees transaction', async () => {
    // 1) create code
    const c = await auth(request(app).post('/api/recharge/create-one'), tokens.vendor)
      .send({ amount: 3000 })
      .expect(201);
    expect(c.body?.data?.code).toBeDefined();
    const code = c.body.data.code;

    // 2) passenger uses code
    const use = await auth(request(app).post('/api/recharge/use'), tokens.passenger)
      .send({ code })
      .expect(200);
    expect(String(use.body.message || '')).toMatch(/تم شحن رصيدك/);

    // 3) vendor transactions (fallback OK)
    const vt = await auth(request(app).get('/api/recharge/vendor-transactions'), tokens.vendor)
      .expect(200);
    const items = vt.body?.data || [];
    expect(items.length).toBeGreaterThan(0);
    // أحد العناصر يجب أن يحمل الوصف بالمحتوى نفسه
    expect(items.some(x => (x.description || '').includes(code))).toBe(true);
  });
});
