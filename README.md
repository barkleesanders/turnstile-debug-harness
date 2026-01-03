# Cloudflare Turnstile Debug Harness

This repo demonstrates how to wrap a legacy registration flow—modeled after the `selfregblocked.xhtml` page on `my.ny.gov`—with modern bot protection. It now includes both [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) and a fixed Google reCAPTCHA implementation plus Carmack-style harnesses and lightweight debug instrumentation.

## Why this matters for my.ny.gov

- The public `selfregblocked.xhtml` page shows users a dead-end when verification fails but does not surface actionable mitigations.
- Bot traffic can repeatedly hit the registration endpoints, increasing the chances of false positives (manual review blocks) and rate limits.
- Adding Turnstile at the form edge gives NY.gov a low-friction CAPTCHA replacement plus verifiable telemetry that feeds into downstream escalation paths.

This repo ships:

1. `public/index.html` – a generic Turnstile-enabled form.
2. `public/nygov.html` / `public/selfreg-fixed.html` – faithful reproductions of the NY.gov “identity not verified” flow with a working Turnstile gate.
3. `public/selfreg-recaptcha.html` – the same UI repaired to use the existing Google reCAPTCHA widget (no Turnstile swap required).
4. `examples/nygov/selfreg-turnstile-snippet.xhtml` and `examples/nygov/selfregblocked-recaptcha.xhtml` – copy/paste snippets for either bot solution inside the JSF/PrimeFaces template.
5. `src/turnstile.js` / `src/recaptcha.js` – server-side helpers to call the respective `/siteverify` endpoints.
6. `src/instrumentation/*` – Carmack harness + debug-agent middleware so you can gather evidence before and after the change.

## Quick start

```bash
git clone https://github.com/barkleesanders/turnstile-debug-harness.git
cd turnstile-debug-harness
cp .env.example .env # supply your Cloudflare keys
npm install
npm test           # runs unit + API tests
npm run harness    # Carmack harness for edge cases
npm start          # http://localhost:3000
```

Visit:

- `http://localhost:3000/index.html` for the generic Turnstile form.
- `http://localhost:3000/nygov.html` or `selfreg-fixed.html` for the “blocked” NY.gov experience guarded by Turnstile.
- `http://localhost:3000/selfreg-recaptcha.html` to see the repaired reCAPTCHA workflow.

## Applying to the NY.gov Self Registration page

Choose one of the following paths depending on whether you want to keep reCAPTCHA or move to Turnstile.

### Option A – Keep Google reCAPTCHA (fix the current implementation)

1. **Configure site/secret keys** – populate `RECAPTCHA_SITE_KEY`/`RECAPTCHA_SECRET_KEY` (the repo ships with Google’s test pair; replace with the Enterprise keys bound to `my.ny.gov`).
2. **Render the widget** – copy `examples/nygov/selfregblocked-recaptcha.xhtml` into `selfregblocked.xhtml`. It injects the `<div id="recaptcha-widget">` container, hidden input, and JS glue that stores the callback token.
3. **Submit with token** – the provided `submitWithRecaptcha` helper blocks submission until a token exists and then stores it into `registrationerrorform:recaptchaToken` so JSF posts it back.
4. **Verify server-side** – call `verifyRecaptchaToken` (see `src/recaptcha.js`) in your backing bean/servlet. When `success === false`, bubble up `error-codes` for easier escalation.
5. **Observe** – the DebugAgent will emit `recaptcha.verification.*` traces so support knows whether the CAPTCHA failed or the identity check failed.

Run `npm start` locally and open `/selfreg-recaptcha.html` to confirm tokens are set correctly before copying the snippets into production.

### Option B – Switch to Cloudflare Turnstile

1. **Inject the widget** – copy the snippet in `examples/nygov/selfreg-turnstile-snippet.xhtml` into the real `selfregblocked.xhtml` template. It adds the Turnstile script, creates a `<div id="turnstile-wrapper">`, and populates a hidden input `turnstileToken`.
2. **Include the controller script** – reference `/public/nygov.js` (or the minified version) so the widget renders after the universal navigation loads.
3. **Send the token** – ensure the JSF form posts `turnstileToken` alongside the user’s personal info.
4. **Verify server-side** – import `verifyTurnstileToken` from `src/turnstile.js` (or port the function) inside the PrimeFaces backing bean / servlet. Reject requests when `verification.success === false` and surface the `error-codes` to your escalation team.
5. **Instrument** – leave `DebugAgent` (or your logging equivalent) enabled so Help Desk receives trace IDs for every failure.

Because Turnstile is purely front-end+API driven, no backend templating changes are required beyond adding the hidden field and verification call.

### Escalation workflow reference

- `DebugAgent` logs events like `turnstile.verification.complete` with both the result code and the masked user identifier.
- Use these logs to automatically open a ticket when `code === 'turnstile-rejected'`, giving support staff proof the system blocked a suspicious attempt instead of a legitimate applicant.

## Files of interest

| Path | Purpose |
| --- | --- |
| `public/nygov.html`, `public/selfreg-fixed.html` | Styled facsimiles of the NY.gov blocked page with Turnstile integrated. |
| `public/selfreg-recaptcha.html` | Local mock of the repaired reCAPTCHA workflow. |
| `public/nygov.js`, `public/selfreg-fixed.js`, `public/selfreg-recaptcha.js` | Controllers that map NY.gov form IDs to the API endpoints, explain failure reasons, and reset the widgets. |
| `examples/nygov/selfreg-turnstile-snippet.xhtml` | Turnstile snippet for the production JSF template. |
| `examples/nygov/selfregblocked-recaptcha.xhtml` | Repaired reCAPTCHA snippet for the JSF template. |
| `src/instrumentation/debugAgent.js` | Drop-in middleware for live HTTP trace logging. |
| `src/instrumentation/carmackHarness.js` | Assertion harness to reproduce CAPTCHA flows offline. |

## Deployment notes

1. Provision Cloudflare Turnstile and/or Google reCAPTCHA keys scoped to `my.ny.gov`.
2. Store them in your deployment platform’s secret manager (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`).
3. Run `npm start` (or integrate with your existing Node/Java stack) to expose `/api/register`, `/api/register-recaptcha`, and the config endpoints; these are thin wrappers you can translate to your environment.
4. Update CI to execute `npm test` and `npm run harness` before every deploy to ensure security controls remain intact.

With these pieces, NY.gov engineers can graft Turnstile onto the blocked registration flow in minutes, reducing false blocks and providing a structured escalation path.
