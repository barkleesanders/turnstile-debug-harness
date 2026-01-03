import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRecaptchaToken } from '../src/recaptcha.js';

test('verifyRecaptchaToken returns missing-token when absent', async () => {
  const result = await verifyRecaptchaToken({ token: '', secretKey: 'secret' });
  assert.equal(result.success, false);
  assert.equal(result.code, 'missing-token');
});

test('verifyRecaptchaToken propagates HTTP errors', async () => {
  const result = await verifyRecaptchaToken({
    token: 'abc',
    secretKey: 'secret',
    fetchImpl: async () => ({ ok: false, status: 503 })
  });
  assert.equal(result.success, false);
  assert.equal(result.code, 'recaptcha-http-error');
  assert.equal(result.detail.status, 503);
});

test('verifyRecaptchaToken passes success responses', async () => {
  const result = await verifyRecaptchaToken({
    token: 'abc',
    secretKey: 'secret',
    fetchImpl: async () => ({ ok: true, json: async () => ({ success: true }) })
  });
  assert.equal(result.success, true);
  assert.equal(result.code, 'ok');
});
