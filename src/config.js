import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  return {
    port: Number(process.env.PORT) || 3000,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || '',
    recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY || '',
    logLevel: process.env.LOG_LEVEL || 'info'
  };
}
