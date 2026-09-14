/** Independent storage namespace under the same authenticated owner; never accepts a user id. */
export async function challengeUserId(owner: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`dugout:challenge:${owner}`),
  );
  return (
    'challenge/' +
    Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
  );
}
