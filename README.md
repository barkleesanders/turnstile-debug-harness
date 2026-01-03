# Cloudflare Turnstile Debug Harness

This repo demonstrates how to wrap a legacy registration flow—modeled after the `selfregblocked.xhtml` page on `my.ny.gov`—with [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/), Carmack-style harnesses, and lightweight debug instrumentation.

## Why this matters for my.ny.gov

- The public `selfregblocked.xhtml` page shows users a dead-end when verification fails but does not surface actionable mitigations.
- Bot traffic can repeatedly hit the registration endpoints, increasing the chances of false positives (manual review blocks) and rate limits.
- Adding Turnstile at the form edge gives NY.gov a low-friction CAPTCHA replacement plus verifiable telemetry that feeds into downstream escalation paths.

This repo ships:

1. `public/index.html` – a generic Turnstile-enabled form.
2. `public/nygov.html` – a faithful reproduction of the NY.gov “identity not verified” flow with Turnstile already injected.
3. `examples/nygov/selfreg-turnstile-snippet.xhtml` – drop-in markup for the JSF/PrimeFaces template used on NY.gov.
4. `src/turnstile.js` – server-side helper to call the Turnstile `/siteverify` API.
5. `src/instrumentation/*` – Carmack harness + debug-agent middleware so you can gather evidence before and after the change.

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

Visit `http://localhost:3000/index.html` for the generic form or `http://localhost:3000/nygov.html` to see the re-created NY.gov flow with Turnstile already embedded.

## Applying to the NY.gov Self Registration page

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
| `public/nygov.html` | Styled facsimile of the NY.gov blocked page with Turnstile integrated. |
| `public/nygov.js` | Controller that maps NY.gov form IDs to the generic API endpoint, explains failure reasons, and resets the widget. |
| `examples/nygov/selfreg-turnstile-snippet.xhtml` | Copy/paste snippet for the production JSF template. |
| `src/instrumentation/debugAgent.js` | Drop-in middleware for live HTTP trace logging. |
| `src/instrumentation/carmackHarness.js` | Assertion harness to reproduce Turnstile flows offline. |

## Deployment notes

1. Provision Cloudflare Turnstile site/secret keys scoped to `my.ny.gov` in the Cloudflare dashboard.
2. Store them in your deployment platform’s secret manager (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).
3. Run `npm start` (or integrate with your existing Node/Java stack) to expose `/api/register` and `/api/config` endpoints; these are thin wrappers you can translate to your environment.
4. Update CI to execute `npm test` and `npm run harness` before every deploy to ensure security controls remain intact.

With these pieces, NY.gov engineers can graft Turnstile onto the blocked registration flow in minutes, reducing false blocks and providing a structured escalation path.
