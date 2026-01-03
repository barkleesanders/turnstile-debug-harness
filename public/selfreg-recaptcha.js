let recaptchaWidgetId;
let recaptchaSiteKey;
const form = document.getElementById('selfreg-recaptcha-form');
const statusNode = document.getElementById('recaptcha-status');
const tokenInput = document.getElementById('recaptchaToken');

function setStatus(message, type = '') {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

async function fetchRecaptchaConfig() {
  const response = await fetch('/api/recaptcha-config');
  if (!response.ok) throw new Error('Unable to load reCAPTCHA config');
  const data = await response.json();
  return data.recaptchaSiteKey;
}

window.initSelfregRecaptcha = async function initSelfregRecaptcha() {
  try {
    recaptchaSiteKey = await fetchRecaptchaConfig();
    if (!recaptchaSiteKey) {
      setStatus('Server missing RECAPTCHA_SITE_KEY', 'error');
      return;
    }

    recaptchaWidgetId = grecaptcha.render('recaptcha-widget', {
      sitekey: recaptchaSiteKey,
      callback: (token) => {
        tokenInput.value = token;
        setStatus('reCAPTCHA solved. Submit to continue.', 'success');
      },
      'expired-callback': () => {
        tokenInput.value = '';
        setStatus('Token expired. Please solve reCAPTCHA again.', 'error');
      },
      'error-callback': () => {
        tokenInput.value = '';
        setStatus('reCAPTCHA error. Reload the page.', 'error');
      }
    });
  } catch (error) {
    setStatus(`Failed to initialize reCAPTCHA: ${error.message}`, 'error');
  }
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!tokenInput.value) {
    setStatus('Solve reCAPTCHA first.', 'error');
    grecaptcha.reset(recaptchaWidgetId);
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  setStatus('Submitting to /api/register-recaptcha…');

  const response = await fetch('/api/register-recaptcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.firstName,
      email: payload.email,
      recaptchaToken: tokenInput.value
    })
  });

  const body = await response.json();
  if (!response.ok) {
    setStatus(body.error || 'Registration failed.', 'error');
    grecaptcha.reset(recaptchaWidgetId);
    tokenInput.value = '';
    return;
  }

  setStatus(body.message || 'Registration accepted.', 'success');
  form.reset();
  tokenInput.value = '';
  grecaptcha.reset(recaptchaWidgetId);
});
