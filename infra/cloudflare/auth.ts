import { timingSafeEqual } from 'node:crypto';
import { guestUserId, newGuestToken, readGuestToken } from '../../apps/api/src/auth/guest-session';

export type AuthEnvironment = {
  AUTH_PROVIDER?: string;
  MIGRATION_EXPORT_TOKEN?: string;
  MIGRATION_OWNER_ID?: string;
  MIGRATION_IMPORT_TOKEN?: string;
  MIGRATION_TARGET_ID?: string;
  MIGRATION_TRANSFER_EXPIRES?: string;
};

async function equalSecret(a: string, b: string) {
  const digest = (value: string) =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  return timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}

export async function authenticateRequest(request: Request, env: AuthEnvironment) {
  const url = new URL(request.url);
  let user: string | null = null;
  let token: string | null = null;
  let newSession = false;
  let transfer = false;
  const exportRequest =
    env.AUTH_PROVIDER === 'sites' &&
    request.method === 'GET' &&
    url.pathname === '/api/career/export';
  const importRequest =
    env.AUTH_PROVIDER === 'guest' &&
    request.method === 'POST' &&
    url.pathname === '/api/career/import';
  const expected = exportRequest
    ? env.MIGRATION_EXPORT_TOKEN
    : importRequest
      ? env.MIGRATION_IMPORT_TOKEN
      : null;
  const owner = exportRequest
    ? env.MIGRATION_OWNER_ID
    : importRequest
      ? env.MIGRATION_TARGET_ID
      : null;
  if (expected && owner && Date.now() < Date.parse(env.MIGRATION_TRANSFER_EXPIRES || '')) {
    const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    if (await equalSecret(supplied, expected)) {
      user = owner;
      transfer = true;
    }
  }
  if (!user && env.AUTH_PROVIDER === 'sites')
    user = request.headers.get('oai-authenticated-user-id');
  if (!user && env.AUTH_PROVIDER === 'guest' && url.pathname !== '/api/health') {
    const existing = readGuestToken(request);
    token = existing || newGuestToken();
    newSession = !existing;
    user = await guestUserId(token);
  }
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.startsWith('oai-authenticated-') || name.startsWith('x-dugout-')) headers.delete(name);
  }
  if (user) headers.set('x-dugout-user-id', user);
  if (token) headers.set('x-dugout-session-token', token);
  if (transfer && importRequest) headers.set('x-dugout-transfer', 'import');
  return { request: new Request(request, { headers }), user, token, newSession };
}
