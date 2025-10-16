const { request, app } = require('./helpers');

test('health endpoint works', async () => {
  const res = await request(app()).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('ok', true);
});
