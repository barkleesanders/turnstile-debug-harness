import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTurnstileToken } from '../src/turnstile.js';

test('verifyTurnstileToken returns missing-token when absent', async () => {
  const result = await verifyTurnstileToken({ token: '', secretKey: 'secret' });
  assert.equal(result.success, false);
  assert.equal(result.code, 'missing-token');
});

test('verifyTurnstileToken propagates HTTP errors', async () => {
  const result = await verifyTurnstileToken({
    token: 'abc',
    secretKey: 'secret',
    fetchImpl: async () => ({ ok: false, status: 503 })
  });
  assert.equal(result.success, false);
  assert.equal(result.code, 'turnstile-http-error');
  assert.equal(result.detail.status, 503);
});

test('verifyTurnstileToken passes success responses', async () => {
  const result = await verifyTurnstileToken({
    token: 'abc',
    secretKey: 'secret',
    fetchImpl: async () => ({ ok: true, json: async () => ({ success: true }) })
  });
  assert.equal(result.success, true);
  assert.equal(result.code, 'ok');
});
