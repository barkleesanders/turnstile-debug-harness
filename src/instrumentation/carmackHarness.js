import assert from 'node:assert/strict';
import { verifyTurnstileToken } from '../turnstile.js';

class CarmackHarness {
  constructor() {
    this.results = [];
  }

  async run() {
    await this.expect('accepts successful verification payloads', async () => {
      const result = await verifyTurnstileToken({
        token: 'abc',
        secretKey: 'secret',
        fetchImpl: async () => ({ ok: true, json: async () => ({ success: true }) })
      });
      assert.equal(result.success, true);
      assert.equal(result.code, 'ok');
    });

    await this.expect('rejects when token missing', async () => {
      const result = await verifyTurnstileToken({ token: '', secretKey: 'secret' });
      assert.equal(result.success, false);
      assert.equal(result.code, 'missing-token');
    });

    await this.expect('bubbles up HTTP errors with metadata', async () => {
      const result = await verifyTurnstileToken({
        token: 'abc',
        secretKey: 'secret',
        fetchImpl: async () => ({ ok: false, status: 500 })
      });
      assert.equal(result.success, false);
      assert.equal(result.code, 'turnstile-http-error');
      assert.equal(result.detail.status, 500);
    });
  }

  async expect(label, fn) {
    try {
      await fn();
      this.results.push({ label, status: 'passed' });
    } catch (error) {
      this.results.push({ label, status: 'failed', error });
    }
  }
}

async function main() {
  const harness = new CarmackHarness();
  await harness.run();
  const failed = harness.results.filter((r) => r.status === 'failed');

  for (const result of harness.results) {
    const prefix = result.status === 'passed' ? '[PASS]' : '[FAIL]';
    console.log(`${prefix} ${result.label}`);
    if (result.error) {
      console.error(result.error);
    }
  }

  if (failed.length) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
