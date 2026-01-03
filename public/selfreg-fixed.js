let selfregWidgetId;
const form = document.getElementById('selfreg-form');
const statusNode = document.getElementById('selfreg-status');
const tokenField = document.getElementById('turnstileToken');

function setStatus(message, type = '') {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

async function fetchSiteKey() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Unable to load config');
  const body = await res.json();
  return body.turnstileSiteKey;
}

window.renderSelfregTurnstile = async function renderSelfregTurnstile() {
  try {
    const siteKey = await fetchSiteKey();
    if (!siteKey) {
      setStatus('Server missing TURNSTILE_SITE_KEY', 'error');
      return;
    }

    selfregWidgetId = turnstile.render('#selfreg-turnstile', {
      sitekey: siteKey,
      callback: (token) => {
        tokenField.value = token;
        setStatus('Turnstile solved. Submit to continue.', 'success');
      },
      'expired-callback': () => {
        tokenField.value = '';
        setStatus('Turnstile expired. Solve again.', 'error');
      },
      'error-callback': () => {
        tokenField.value = '';
        setStatus('Turnstile error. Reload the page.', 'error');
      }
    });
  } catch (error) {
    setStatus(`Turnstile failed to load: ${error.message}`, 'error');
  }
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!tokenField.value) {
    setStatus('Solve Turnstile first.', 'error');
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  setStatus('Submitting registration…');

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${payload.firstName} ${payload.lastName}`.trim(),
      email: payload.email,
      phone: payload.phone,
      turnstileToken: payload.turnstileToken
    })
  });

  const body = await res.json();
  if (!res.ok) {
    setStatus(body.error || 'Registration failed.', 'error');
    turnstile.reset(selfregWidgetId);
    tokenField.value = '';
    return;
  }

  setStatus(body.message || 'Registration accepted.', 'success');
  form.reset();
  tokenField.value = '';
  turnstile.reset(selfregWidgetId);
});
