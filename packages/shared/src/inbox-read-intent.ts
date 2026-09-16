export function isDateProgressCommand(type: unknown) {
  return [
    'continue',
    'continueDay',
    'advance',
    'managerContinue',
    'nextSeason',
    'skipPreseason',
    'completeMatch',
    'startMatch',
    'delegateMatch',
    'beginSeriesDelegation',
    'delegateSeriesDay',
  ].includes(String(type));
}
export function pendingReadIds(action: Record<string, unknown>): Set<string> {
  if (!isDateProgressCommand(action.type) || action.readNewsIds === undefined) return new Set();
  const ids = action.readNewsIds;
  if (
    !Array.isArray(ids) ||
    ids.length > 2000 ||
    ids.some((id) => typeof id !== 'string' || !id || id.length > 240)
  )
    throw new Error('읽은 보고 목록을 확인해 주세요.');
  return new Set(ids as string[]);
}
