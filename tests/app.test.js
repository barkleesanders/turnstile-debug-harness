import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

const baseConfig = {
  port: 0,
  turnstileSiteKey: '1x00000000000000000000AA',
  turnstileSecretKey: 'secret',
  recaptchaSiteKey: 'test-site',
  recaptchaSecretKey: 'test-secret'
};

test('GET /api/config returns the public site key', async () => {
  const app = createApp({ config: baseConfig });
  const res = await request(app).get('/api/config');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.turnstileSiteKey, baseConfig.turnstileSiteKey);
});

test('POST /api/register rejects bad payloads up front', async () => {
  const app = createApp({ config: baseConfig });
  const res = await request(app).post('/api/register').send({});
  assert.equal(res.statusCode, 400);
});

test('POST /api/register returns 403 when Turnstile fails', async () => {
  const app = createApp({
    config: baseConfig,
    services: {
      verifyTurnstileToken: async () => ({ success: false, code: 'turnstile-rejected', detail: {} })
    }
  });

  const res = await request(app)
    .post('/api/register')
    .send({ name: 'Pat', email: 'pat@example.com', turnstileToken: 'abc' });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'turnstile-rejected');
});

test('POST /api/register succeeds when Turnstile passes', async () => {
  const app = createApp({
    config: baseConfig,
    services: {
      verifyTurnstileToken: async () => ({ success: true, code: 'ok', detail: {} })
    }
  });

  const res = await request(app)
    .post('/api/register')
    .send({ name: 'Pat', email: 'pat@example.com', turnstileToken: 'abc' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
});

test('GET /api/recaptcha-config returns the site key', async () => {
  const app = createApp({ config: baseConfig });
  const res = await request(app).get('/api/recaptcha-config');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.recaptchaSiteKey, baseConfig.recaptchaSiteKey);
});

test('POST /api/register-recaptcha rejects bad payloads', async () => {
  const app = createApp({ config: baseConfig });
  const res = await request(app).post('/api/register-recaptcha').send({});
  assert.equal(res.statusCode, 400);
});

test('POST /api/register-recaptcha returns 403 when reCAPTCHA fails', async () => {
  const app = createApp({
    config: baseConfig,
    services: {
      verifyRecaptchaToken: async () => ({ success: false, code: 'bad-token', detail: {} })
    }
  });

  const res = await request(app)
    .post('/api/register-recaptcha')
    .send({ name: 'Pat', email: 'pat@example.com', recaptchaToken: 'abc' });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'bad-token');
});

test('POST /api/register-recaptcha succeeds when token passes', async () => {
  const app = createApp({
    config: baseConfig,
    services: {
      verifyRecaptchaToken: async () => ({ success: true, code: 'ok', detail: {} })
    }
  });

  const res = await request(app)
    .post('/api/register-recaptcha')
    .send({ name: 'Pat', email: 'pat@example.com', recaptchaToken: 'abc' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
});
