const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export async function verifyRecaptchaToken({
  token,
  secretKey,
  remoteIp,
  fetchImpl = fetch
}) {
  if (!token) {
    return { success: false, code: 'missing-token' };
  }

  if (!secretKey) {
    throw new Error('RECAPTCHA_SECRET_KEY is not configured');
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!response.ok) {
    return {
      success: false,
      code: 'recaptcha-http-error',
      detail: { status: response.status }
    };
  }

  const body = await response.json();

  return {
    success: Boolean(body.success),
    code: body.success ? 'ok' : body['error-codes']?.[0] || 'recaptcha-rejected',
    detail: body
  };
}
