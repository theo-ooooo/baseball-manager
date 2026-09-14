'use client';
export type CareerSlot = 'main' | 'challenge';
const key = 'dugout:career-slot';
let remembered: CareerSlot | undefined;
export function currentCareerSlot(): CareerSlot {
  if (typeof window === 'undefined') return 'main';
  const query = new URLSearchParams(window.location.search).get('career');
  if (query === 'main' || query === 'challenge') return query;
  if (remembered) return remembered;
  try {
    return sessionStorage.getItem(key) === 'challenge' ? 'challenge' : 'main';
  } catch {
    return 'main';
  }
}
export function switchCareerSlot(slot: CareerSlot) {
  try {
    sessionStorage.setItem(key, slot);
  } catch {}
  window.location.assign(`/?view=home&career=${slot}`);
}
export function careerFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-career-slot', currentCareerSlot());
  return fetch(input, { ...init, headers });
}

export function rememberCareerSlot() {
  remembered = currentCareerSlot();
  try {
    sessionStorage.setItem(key, remembered);
  } catch {}
}
