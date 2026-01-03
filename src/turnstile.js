const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken({
  token,
  secretKey,
  remoteIp,
  fetchImpl = fetch
}) {
  if (!token) {
    return { success: false, code: 'missing-token' };
  }

  if (!secretKey) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured');
  }

  const params = new URLSearchParams({
    secret: secretKey,
    response: token
  });

  if (remoteIp) {
    params.set('remoteip', remoteIp);
  }

  const response = await fetchImpl(VERIFY_URL, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) {
    return {
      success: false,
      code: 'turnstile-http-error',
      detail: { status: response.status }
    };
  }

  const body = await response.json();

  return {
    success: Boolean(body.success),
    code: body.success ? 'ok' : body['error-codes']?.[0] || 'turnstile-rejected',
    detail: body
  };
}
