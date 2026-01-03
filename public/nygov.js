let nygovWidgetId;
const nygovStatus = document.getElementById('nygov-status');
const nygovForm = document.getElementById('registrationerrorform');

function setNygovStatus(message, type = '') {
  nygovStatus.textContent = message;
  nygovStatus.className = `status ${type}`.trim();
}

async function getSiteKey() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Cannot fetch config');
  const json = await res.json();
  return json.turnstileSiteKey;
}

window.renderNygovTurnstile = async function renderNygovTurnstile() {
  try {
    const siteKey = await getSiteKey();
    if (!siteKey) {
      setNygovStatus('TURNSTILE_SITE_KEY missing on the server.', 'error');
      return;
    }

    nygovWidgetId = turnstile.render('#turnstile-wrapper', {
      sitekey: siteKey,
      callback: () => setNygovStatus('Turnstile solved. Submit to retry verification.', 'success'),
      'expired-callback': () => setNygovStatus('Challenge expired. Solve again.', 'error'),
      'error-callback': () => setNygovStatus('Turnstile error. Reload page.', 'error')
    });
  } catch (error) {
    setNygovStatus(`Failed to load Turnstile: ${error.message}`, 'error');
  }
};

nygovForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = nygovWidgetId ? turnstile.getResponse(nygovWidgetId) : '';
  if (!token) {
    setNygovStatus('Solve Turnstile first.', 'error');
    return;
  }

  const payload = Object.fromEntries(new FormData(nygovForm).entries());
  payload.turnstileToken = token;

  setNygovStatus('Contacting /api/register…');

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const body = await res.json();
  if (!res.ok) {
    setNygovStatus(body.error || 'Verification failed.', 'error');
    turnstile.reset(nygovWidgetId);
    return;
  }

  setNygovStatus(body.message || 'Support will now review your case.', 'success');
  turnstile.reset(nygovWidgetId);
  nygovForm.reset();
});
