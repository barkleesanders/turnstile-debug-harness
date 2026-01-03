import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from './config.js';
import { verifyTurnstileToken } from './turnstile.js';
import { DebugAgent } from './instrumentation/debugAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp({ logger = console, config: configOverrides = {}, services = {} } = {}) {
  const appConfig = { ...getConfig(), ...configOverrides };
  const verifyChallenge = services.verifyTurnstileToken || verifyTurnstileToken;
  const debugAgent = new DebugAgent(logger);

  const app = express();
  app.use(debugAgent.middleware());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));

  app.get('/api/config', (_req, res) => {
    res.json({ turnstileSiteKey: appConfig.turnstileSiteKey });
  });

  app.post('/api/register', async (req, res) => {
    const { name, email, turnstileToken } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    try {
      const verification = await verifyChallenge({
        token: turnstileToken,
        secretKey: appConfig.turnstileSecretKey,
        remoteIp: req.ip
      });

      debugAgent.trace('turnstile.verification.complete', {
        success: verification.success,
        code: verification.code
      });

      if (!verification.success) {
        return res.status(403).json({
          error: 'Turnstile verification failed.',
          code: verification.code,
          detail: verification.detail
        });
      }

      return res.json({ ok: true, message: `Thanks ${name}, your submission has been accepted.` });
    } catch (error) {
      debugAgent.trace('turnstile.verification.error', { message: error.message });
      return res.status(500).json({ error: 'Server error' });
    }
  });

  return app;
}
