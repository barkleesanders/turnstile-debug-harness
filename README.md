# NY.gov CAPTCHA Debug Harness

Debug tools and hotfixes for NY.gov registration CAPTCHA issues.

---

## 🚨 CRITICAL FIX: BotDetect CAPTCHA Invisible (Jan 2026)

### The Problem

The CAPTCHA on `itsny.govqa.us` registration page is **completely invisible** due to a CSS layout bug. The BotDetect CAPTCHA image renders with **0x0 pixel dimensions**, blocking all user registrations.

### Root Cause

| Issue | Detail |
|-------|--------|
| **CAPTCHA Type** | BotDetect (not Google reCAPTCHA) |
| **Bug** | Image element has `offsetWidth: 0`, `offsetHeight: 0` |
| **Image Status** | Loads correctly (5,772 bytes) but collapses to invisible |
| **Cause** | CSS layout collapse in DevExpress parent containers |

### Quick Fix

**Option 1: Console Hotfix (Immediate)**

Paste this in browser DevTools on the registration page:

```javascript
// Fix BotDetect CAPTCHA visibility
document.querySelectorAll('[id*="CaptchaImage"]').forEach(el => {
  el.style.cssText = 'width:250px!important;height:50px!important;display:inline-block!important';
  let p = el.parentElement;
  for(let i=0; i<3 && p; i++, p=p.parentElement) {
    p.style.cssText = 'min-width:260px!important;min-height:60px!important;display:block!important';
  }
});
```

**Option 2: Full Debug Hotfix**

Load `public/nygov-hotfix.js` which includes:
- CAPTCHA visibility fix
- DebugAgent for logging all events
- Form submission interception
- Network request monitoring
- Downloadable JSON logs

```javascript
// Bookmarklet to load hotfix
javascript:(function(){var s=document.createElement('script');s.src='http://localhost:3000/nygov-hotfix.js';document.body.appendChild(s);})();
```

**Option 3: Production CSS Fix**

Add to site stylesheet:

```css
#c_customerdetails_captchaformlayout_captcha_CaptchaImage,
[id*="CaptchaImage"] {
  width: 250px !important;
  height: 50px !important;
  display: inline-block !important;
}
```

---

## Quick Start

```bash
git clone https://github.com/barkleesanders/turnstile-debug-harness.git
cd turnstile-debug-harness
cp .env.example .env
npm install
npm start          # http://localhost:3000
```

Visit:
- `/nygov-hotfix.js` — the BotDetect CAPTCHA fix script
- `/selfreg-recaptcha.html` — reCAPTCHA demo (if migrating from BotDetect)
- `/nygov.html` — Turnstile demo (modern alternative)

---

## Files

| Path | Purpose |
|------|---------|
| **`public/nygov-hotfix.js`** | 🔧 **BotDetect CAPTCHA fix + DebugAgent** |
| `public/selfreg-recaptcha.html` | Google reCAPTCHA demo page |
| `public/nygov.html` | Cloudflare Turnstile demo page |
| `examples/nygov/selfregblocked-recaptcha.xhtml` | JSF snippet for reCAPTCHA migration |
| `src/recaptcha.js` | Server-side reCAPTCHA token verification |
| `src/turnstile.js` | Server-side Turnstile token verification |
| `src/instrumentation/debugAgent.js` | HTTP trace logging middleware |

---

## CAPTCHA Migration Options

### Option A: Keep BotDetect (Apply CSS Fix)

The current implementation uses BotDetect. Apply the CSS fix above to restore visibility.

### Option B: Migrate to Google reCAPTCHA

1. Add `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` to environment
2. Copy `examples/nygov/selfregblocked-recaptcha.xhtml` to your JSF template
3. Call `verifyRecaptchaToken()` from `src/recaptcha.js` server-side

### Option C: Migrate to Cloudflare Turnstile

1. Add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to environment
2. Copy `examples/nygov/selfreg-turnstile-snippet.xhtml` to your JSF template
3. Call `verifyTurnstileToken()` from `src/turnstile.js` server-side

---

## Debug Agent

The hotfix includes a DebugAgent that logs:

```javascript
window.debugAgent.trace('event.name', { payload: 'data' });
window.debugAgent.downloadLogs(); // Export JSON trace
```

Events tracked:
- `page.load` — URL, title, user agent
- `captcha.visibility.fixed` — when CSS fix applied
- `form.submit.attempt` — form submission with CAPTCHA value
- `network.fetch.*` — all fetch/XHR requests
- `error.*` — uncaught errors

---

## Environment Variables

```bash
PORT=3000
TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key
RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key
```

---

## License

MIT
