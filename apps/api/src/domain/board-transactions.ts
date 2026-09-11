import type { GameState, Player } from '@dugout/shared/types';
import { playerClubStanding } from '@dugout/shared/trade-policy';
import { gameDate } from '@dugout/shared/calendar';
import { postNews } from './club-dynamics';
/** Called only after final validation, before ownership changes, inside the transaction. */
export function recordBoardTransaction(
  g: GameState,
  id: string,
  incoming: Player[],
  outgoing: Player[],
  otherRoster: Player[],
) {
  const job = g.managerJobs?.[g.club];
  if (!job || g.managerCareer?.status === 'unemployed') return;
  if (!job.transfers || job.transfers.year !== g.year || job.transfers.appointed !== job.appointed)
    job.transfers = { year: g.year, appointed: job.appointed, credit: 0, events: [], acquired: [] };
  const ledger = job.transfers;
  if (ledger.events.some((e) => e.id === id)) return;
  const parts: string[] = [];
  let change = 0;
  for (const p of incoming) {
    const s = playerClubStanding(p, otherRoster);
    const points = ledger.acquired.includes(p.id)
      ? 0
      : { franchise: 10, core: 5, prospect: 2, starter: 0, depth: 0 }[s.tier];
    if (points) {
      change += points;
      parts.push(`${s.label} ${p.name} 영입 +${points}`);
      ledger.acquired.push(p.id);
    }
  }
  for (const p of outgoing) {
    const s = playerClubStanding(p, g.roster);
    const points = { franchise: 12, core: 5, prospect: 2, starter: 0, depth: 0 }[s.tier];
    if (points) {
      change -= points;
      parts.push(`${s.label} ${p.name} 이탈 −${points}`);
    }
  }
  const before = ledger.credit;
  ledger.credit = Math.max(-25, Math.min(20, before + change));
  const applied = ledger.credit - before;
  const reason = parts.join(' · ') || '핵심 전력의 변동 없이 선수층을 조정했습니다.';
  ledger.events = [{ id, date: gameDate(g), change: applied, reason }, ...ledger.events].slice(
    0,
    60,
  );
  job.confidence = Math.max(0, Math.min(100, job.confidence + applied));
  if (parts.length)
    postNews(
      g,
      '이사회 · 선수단 구성 평가',
      `${reason}\n이번 거래 평가 ${applied > 0 ? '+' : ''}${applied} · 시즌 거래 평가 ${ledger.credit > 0 ? '+' : ''}${ledger.credit}. 경기 성적과 함께 감독 신뢰에 반영합니다.`,
      'manager',
      { id: `board-trade:${id}`, actionView: 'vision' },
    );
}
