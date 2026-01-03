# NY.gov CAPTCHA Bug — Technical Deep Dive & FOIL Documentation

This document provides comprehensive technical analysis of the BotDetect CAPTCHA visibility bug affecting NY.gov systems, including the GovQA FOIL portal and the SelfRegV3 registration application.

---

## Executive Summary

| Issue | Impact | Status |
|-------|--------|--------|
| BotDetect CAPTCHA invisible | Users cannot complete CAPTCHA → blocked from registration/FOIL submission | **Fixed via hotfix** |
| GovQA FOIL portal inaccessible | Public cannot submit Freedom of Information requests | **FOIL submitted using fix** |
| SelfRegV3 registration blocked | New users cannot create NY.gov accounts | **Under investigation** |

---

## Part 1: The Bug

### What's Happening

The BotDetect CAPTCHA image on multiple NY.gov systems renders with **0×0 pixel dimensions**, making it completely invisible to users. The CAPTCHA validation still runs server-side, so users are blocked from submitting forms even though they cannot see the challenge.

### Affected Systems

| System | URL | Status |
|--------|-----|--------|
| GovQA FOIL Portal | `itsny.govqa.us/WEBAPP/_rs/.../CustomerDetails.aspx` | Fixed with hotfix |
| GovQA Request Form | `itsny.govqa.us/WEBAPP/_rs/.../RequestOpen.aspx` | Fixed with hotfix |
| SelfRegV3 Registration | `my.ny.gov/SelfRegV3/selfregblocked.xhtml` | Needs investigation |

### Root Cause Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                    CSS Layout Collapse Chain                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Parent Container (DevExpress Layout)                     │   │
│  │ offsetWidth: 0  │  offsetHeight: 0  │  display: block   │   │
│  │                                                          │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ Intermediate Container                             │  │   │
│  │  │ offsetWidth: 0  │  offsetHeight: 0                 │  │   │
│  │  │                                                    │  │   │
│  │  │  ┌─────────────────────────────────────────────┐  │  │   │
│  │  │  │ CAPTCHA Image                                │  │  │   │
│  │  │  │ src: "BotDetectCaptcha.ashx?get=image..."   │  │  │   │
│  │  │  │ naturalWidth: 250  (image loads correctly)  │  │  │   │
│  │  │  │ offsetWidth: 0     (but renders invisible)  │  │  │   │
│  │  │  └─────────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Finding:** The CAPTCHA image loads successfully from the server (5,772 bytes), but the DevExpress/Telerik CSS causes parent containers to collapse to zero dimensions, hiding the image.

### Diagnostic Evidence

```javascript
// Image element inspection
{
  src: "https://itsny.govqa.us/.../BotDetectCaptcha.ashx?get=image&...",
  naturalWidth: 250,      // Image loaded correctly
  naturalHeight: 50,      // Image loaded correctly
  offsetWidth: 0,         // BUG: Rendered as invisible
  offsetHeight: 0,        // BUG: Rendered as invisible
  display: "inline",      // CSS says it should display
  visibility: "visible"   // CSS says it should be visible
}
```

The image is loaded and technically "visible" per CSS, but its dimensions collapse due to parent container sizing issues.

---

## Part 2: The Fix

### Immediate Fix (Console Injection)

```javascript
// Paste in browser console on affected pages
(function() {
  document.querySelectorAll('[id*="CaptchaImage"]').forEach(el => {
    el.style.cssText = 'width:250px!important;height:50px!important;display:inline-block!important';
    let p = el.parentElement;
    for(let i=0; i<3 && p; i++, p=p.parentElement) {
      p.style.cssText = 'min-width:260px!important;min-height:60px!important;display:block!important';
    }
  });
  console.log('CAPTCHA fix applied');
})();
```

### Full Debug Hotfix

The file `public/nygov-hotfix.js` provides:

1. **CAPTCHA Visibility Fix** — Forces element dimensions
2. **DebugAgent** — Logs all page events for diagnostics
3. **Form Interception** — Captures submission attempts with token values
4. **Network Monitoring** — Tracks all fetch/XHR requests
5. **Error Handling** — Captures uncaught exceptions
6. **Debug Panel UI** — Floating panel with log export button

### Production Fix Recommendation

Add to site CSS:

```css
/* Fix BotDetect CAPTCHA visibility on DevExpress layouts */
#c_customerdetails_captchaformlayout_captcha_CaptchaImage,
#captchaFormLayout [id*="CaptchaImage"],
[id*="CaptchaImage"],
.BDC_CaptchaImage {
  width: 250px !important;
  height: 50px !important;
  display: inline-block !important;
  visibility: visible !important;
}

/* Ensure parent containers don't collapse */
#captchaFormLayout,
[id*="captchaFormLayout"] {
  min-width: 260px !important;
  min-height: 70px !important;
  display: block !important;
}
```

---

## Part 3: FOIL Request Submitted

Due to the CAPTCHA bug blocking access to the GovQA portal, we applied the fix and submitted a Freedom of Information Law request to investigate the broader issues.

### Request Details

| Field | Value |
|-------|-------|
| **Reference Number** | R000252-010326 |
| **Submitted** | January 3, 2026 |
| **Response Due** | February 3, 2026 |
| **Agency** | NYS Office of Information Technology Services |

### Records Requested (Section A)

1. **Contractor Identification** — Contracts and SOWs for SelfRegV3, specifically build "12/05/2025 9:11 PM W: (NULL) A: 169PB_1"

2. **Verification Logic** — Technical specs for the "identity not verified" blocked state

3. **Escalation Procedures** — Runbooks for helping blocked registrants, including reCAPTCHA Enterprise (Site Key: `6LcCiesgAAAAAPkxED9obX0-Odo6BPRIApERiXV5`) and Dynatrace monitoring

4. **Security Configuration** — TSPD scripts, PrimeFaces v10, IP restrictions

5. **Incident History** — Bug reports and tickets since January 1, 2025

### Vulnerability Notification (Section B)

The FOIL request includes notification of the BotDetect CAPTCHA vulnerability with:
- Root cause analysis
- Reference to this repository's fix
- Pro bono remediation offer
- Request to forward to CISO

---

## Part 4: Technical Stack Analysis

### GovQA Portal (itsny.govqa.us)

| Component | Version/Details |
|-----------|-----------------|
| Platform | ASP.NET WebForms |
| UI Framework | DevExpress |
| CAPTCHA | Lanap BotDetect |
| Session | Cookie-based with URL-encoded session ID |

### SelfRegV3 (my.ny.gov)

| Component | Version/Details |
|-----------|-----------------|
| Platform | Java/JSF |
| UI Framework | PrimeFaces v10 |
| CAPTCHA | Google reCAPTCHA Enterprise |
| Site Key | `6LcCiesgAAAAAPkxED9obX0-Odo6BPRIApERiXV5` |
| Monitoring | Dynatrace (agent: `f00ca550ded2849e`) |
| Analytics | Google Analytics UA-49859957-1 |

### Security Layers Observed

- TSPD scripts (likely Imperva/Incapsula bot protection)
- reCAPTCHA Enterprise
- Dynatrace RUM agent
- Session token validation
- IP-based restrictions (curl requests reset)

---

## Part 5: Reproduction Steps

### GovQA CAPTCHA Bug

1. Navigate to `https://itsny.govqa.us/WEBAPP/_rs/.../CustomerDetails.aspx`
2. Scroll to "New Account Registration" section
3. Observe: CAPTCHA section appears blank/blue
4. Open DevTools → Elements
5. Find `#c_customerdetails_captchaformlayout_captcha_CaptchaImage`
6. Observe: `offsetWidth: 0, offsetHeight: 0`
7. Apply fix: Set explicit width/height
8. Observe: CAPTCHA code now visible (e.g., "V9DC", "UAUWP")

### Verification

```javascript
// Check if bug exists
const img = document.querySelector('[id*="CaptchaImage"]');
console.log({
  naturalWidth: img.naturalWidth,  // Should be 250 (image loaded)
  offsetWidth: img.offsetWidth,    // Will be 0 if bug exists
  src: img.src                     // Confirm it's BotDetect URL
});
```

---

## Files in This Repository

| File | Purpose |
|------|---------|
| `public/nygov-hotfix.js` | Full debug hotfix with DebugAgent |
| `public/selfreg-recaptcha.html` | reCAPTCHA migration demo |
| `public/nygov.html` | Cloudflare Turnstile demo |
| `src/recaptcha.js` | Server-side reCAPTCHA verification |
| `src/turnstile.js` | Server-side Turnstile verification |
| `examples/nygov/*.xhtml` | JSF snippets for production |

---

## Timeline

| Date | Event |
|------|-------|
| Jan 3, 2026 12:30 | Bug discovered on GovQA registration page |
| Jan 3, 2026 12:35 | Root cause identified (CSS collapse) |
| Jan 3, 2026 12:38 | Hotfix created and tested |
| Jan 3, 2026 12:40 | Fix pushed to GitHub (commit b1aabe2) |
| Jan 3, 2026 12:45 | FOIL request R000252-010326 submitted |
| Jan 3, 2026 12:48 | Documentation updated |

---

## Contact

For questions about this fix or the FOIL request, see the GitHub issues or contact the repository maintainer.

**Repository:** https://github.com/barkleesanders/turnstile-debug-harness
