import type { GameState } from './types';
import type { ManagerCareer } from './manager-career';

type Departure = ManagerCareer['history'][number];
export function departureLabel(h: Departure) {
  return h.reason === 'resigned'
    ? '사퇴'
    : h.endKind === 'nonrenewal'
      ? '계약 만료 · 재계약 불발'
      : '경질';
}
export function departureDetail(g: Pick<GameState, 'news'>, h: Departure) {
  if (h.detail) return h.detail;
  const report = g.news.find(
    (n) => n.kind === 'manager' && n.date === h.to && n.title === '시즌 목표 미달',
  );
  return (
    report?.body ||
    (h.reason === 'resigned'
      ? '감독 본인이 사퇴 의사를 전달했습니다.'
      : '이전 퇴임 기록에는 구단의 상세 평가가 저장되어 있지 않습니다.')
  );
}
