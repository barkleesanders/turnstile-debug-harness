# SelfRegV3 Registration Bug Analysis

## Critical Finding: Missing SSN Field

The NY.gov SelfRegV3 registration system has a **rendering bug** that prevents the SSN (Social Security Number) field from appearing, causing identity verification to fail for all users.

---

## The Problem

### What Users Experience

1. User fills out Step 1 (name, email, password)
2. User fills out Step 2 (city, zip, date of birth)
3. User clicks "Continue" → reaches Confirmation page
4. User clicks "Create Account" → **BLOCKED**
5. Error: "Unfortunately, your identity was not able to be verified..."

### Root Cause

The registration form contains an **empty SSN panel**:

```html
<span id="selfregform:ssnPanel"></span>  <!-- EMPTY - BUG -->
```

The page loads the SSN masking script (`jquery.maskssn.js`) and the custom UI script (`selfreg-custom-ui.js`) expects to find `.ssnId` elements, **but the SSN input field is never rendered**.

Without an SSN, the server-side identity verification (likely LexisNexis or similar) cannot match the user to any records, causing automatic rejection.

---

## Technical Evidence

### 1. Empty SSN Panel

```javascript
document.getElementById('selfregform:ssnPanel')
// Returns: <span id="selfregform:ssnPanel"></span>
// Contains 0 children
```

### 2. SSN Masking Script Loaded But Unused

```javascript
// From selfreg-custom-ui.js
$('.ssnId').mask("000-00-0000");
// But there are no elements with class 'ssnId' in the DOM
```

### 3. Build Information

```
Build: 12/05/2025 9:11 PM W: (NULL) A: 169PB_1
```

The `W: (NULL)` suggests a null/undefined value in the build metadata, possibly indicating configuration issues.

---

## Registration Flow Analysis

### Step 1: Account Setup (selfregstepone.xhtml)
- First Name ✅
- Last Name ✅
- Email ✅
- Password ✅
- Phone ✅

### Step 2: Identity Verification (selfregsteptwo.xhtml)
- City ✅
- Zip Code ✅
- Date of Birth ✅
- SSN ❌ **MISSING - NEVER RENDERS**
- Street Address (marked "Optional" but likely required for verification)

### Step 3: Confirmation (selfregstepthree.xhtml)
- Review entered data
- Create Account button
- reCAPTCHA Enterprise validation

### Result: Blocked (selfregblocked.xhtml)
- Identity verification fails
- No actionable error message
- User has no way to proceed

---

## Additional Issues Found

### 1. reCAPTCHA Token Bug on Confirmation Page

The Step 2 → Step 3 transition generates a reCAPTCHA token via `setToken()`:

```javascript
function setToken() {
    grecaptcha.enterprise.ready(function () {
        grecaptcha.enterprise.execute('6LcCiesgAAAAAPkxED9obX0-Odo6BPRIApERiXV5', {action: 'selfreg'})
        .then(function (token) {
            var fields = document.getElementsByName("g-recaptcha-response");
            if (fields.length > 0) {
                fields[0].value = token;
                PrimeFaces.ab({s: 'selfregform:altSubmit', f: 'selfregform'});
            }
        });
    });
}
```

However, the "Create Account" button on Step 3 does **NOT** call `setToken()`, meaning the final submission may use a stale or missing token.

### 2. JSF EL Expression Failures

CSS contains broken Expression Language references:

```css
@font-face {
  src: url("styles.css.xhtml?ln=css#{resource['...']}");  /* BROKEN */
}
```

### 3. Street Address "Optional" Label

The UI marks Street Address as "(Optional)" but identity verification services typically require a full address to match records. This may be a UX issue causing users to skip a critical field.

---

## Evidence Screenshots

| Screenshot | Description |
|------------|-------------|
| `initial_registration_page_*.png` | Step 2 form with visible fields |
| `dob_filled_registration_*.png` | Birthday entered |
| `registration_confirmation_page_*.png` | Step 3 confirmation |
| `registration_blocked_error_*.png` | Final error page |
| `registration_footer_build_info_*.png` | Build metadata |

---

## Recommendations

### Immediate (Workaround)
There is **no client-side workaround** for the missing SSN field. The user cannot complete registration through the web interface.

### For NY.gov Engineers

1. **Fix SSN Panel Rendering**
   - Check JSF/PrimeFaces conditional rendering logic for `ssnPanel`
   - Verify the backing bean populates the panel content
   - Check for server-side errors in the JSF lifecycle

2. **Review Build Configuration**
   - Investigate `W: (NULL)` in build footer
   - Check if null configuration is propagating to rendering logic

3. **Fix reCAPTCHA on Confirmation Page**
   - Add `setToken()` call to "Create Account" button onclick
   - Or: implement invisible reCAPTCHA auto-execution on page load

4. **Clarify "Optional" Fields**
   - If Street Address improves verification success, remove "(Optional)" label
   - Or provide guidance about what data improves verification chances

---

## FOIL Request Reference

This issue is documented in FOIL Request **R000252-010326**, which requests:
- Verification logic documentation
- Incident history referencing selfregblocked.xhtml
- Escalation procedures for blocked users

---

## Alternative Registration Methods

Since web registration is broken, users may need to:

1. **Call NY.gov Support**: 1-866-942-3472
2. **Visit a local office** for in-person identity verification
3. **Wait for the bug to be fixed** (no timeline available)

---

## Build Reference

```
Application: SelfRegV3
URL: https://my.ny.gov/SelfRegV3/selfregsteptwo.xhtml
Build: 12/05/2025 9:11 PM W: (NULL) A: 169PB_1
reCAPTCHA Site Key: 6LcCiesgAAAAAPkxED9obX0-Odo6BPRIApERiXV5
Dynatrace Agent: f00ca550ded2849e
```
