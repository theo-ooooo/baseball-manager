const cookieName = '__Host-dugout_guest';
const tokenPattern = /^[a-f0-9]{64}$/;

export function readGuestToken(request: Request) {
  const cookies = request.headers.get('cookie')?.split(';') || [];
  const value = cookies
    .find((cookie) => cookie.trim().startsWith(`${cookieName}=`))
    ?.trim()
    .slice(cookieName.length + 1);
  return value && tokenPattern.test(value) ? value : null;
}

export function newGuestToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function guestUserId(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return (
    'guest:' +
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  );
}

export function guestCookie(token: string) {
  return `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=34560000`;
}

export function isSameOriginMutation(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  return (
    request.headers.get('sec-fetch-site') !== 'cross-site' &&
    (!origin || origin === new URL(request.url).origin)
  );
}
