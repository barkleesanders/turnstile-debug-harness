const form = document.querySelector('#demo-form');
const statusNode = document.querySelector('#status');
let widgetId;

function setStatus(message, type = '') {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

async function fetchConfig() {
  const response = await fetch('/api/config');
  return response.json();
}

window.renderTurnstileWidget = async function renderTurnstileWidget() {
  try {
    const { turnstileSiteKey } = await fetchConfig();
    if (!turnstileSiteKey) {
      setStatus('Server is missing TURNSTILE_SITE_KEY configuration.', 'error');
      return;
    }

    widgetId = turnstile.render('#turnstile-widget', {
      sitekey: turnstileSiteKey,
      callback: () => setStatus('Challenge solved. Submit the form to continue.', 'success'),
      'error-callback': () => setStatus('Turnstile encountered an error. Reload the page.', 'error'),
      'expired-callback': () => setStatus('Challenge expired. Please retry.', 'error')
    });
  } catch (error) {
    setStatus('Unable to load configuration: ' + error.message, 'error');
  }
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Submitting…');

  const turnstileToken = widgetId ? turnstile.getResponse(widgetId) : '';
  if (!turnstileToken) {
    setStatus('Solve the Turnstile challenge first.', 'error');
    return;
  }

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.turnstileToken = turnstileToken;

  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    setStatus(body.error || 'Submission failed.', 'error');
    turnstile.reset(widgetId);
    return;
  }

  setStatus(body.message || 'Success!', 'success');
  form.reset();
  turnstile.reset(widgetId);
});
