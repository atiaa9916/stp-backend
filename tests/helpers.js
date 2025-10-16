// tests/helpers.js
const request = require('supertest');

// sugar صغيرة لإرفاق الهيدر
function auth(agent, token) {
  return agent.set('Authorization', `Bearer ${token}`);
}

// جلب الـ app المصنوع في setup-env
function app() {
  return global.__APP__;
}

module.exports = { request, auth, app };
