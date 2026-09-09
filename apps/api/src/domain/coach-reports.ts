import type { GameState, Player } from '@dugout/shared/types';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { overall } from '@dugout/shared/game-view';
import { squadMoveError } from '@dugout/shared/roster-rules';
import { postNews } from './club-dynamics';
import { changeSquad } from './roster-moves';

const statsText = (p: Player, reserve = false) => {
  const s = reserve ? p.reserveStats : p.stats;
  return p.pos === 'P'
    ? `${((s?.outs || 0) / 3).toFixed(1)}이닝 · ERA ${s?.outs ? ((s.er * 27) / s.outs).toFixed(2) : '—'}`
    : `${s?.ab || 0}타수 · 타율 ${s?.ab ? (s.h / s.ab).toFixed(3) : '—'}`;
};
export function coachReports(g: GameState) {
  if (g.day % 7 || g.managerCareer?.status === 'unemployed') return;
  const today = gameDate(g);
  g.coachRecommendations ??= [];
  const recent = new Set(
    g.coachRecommendations.filter((r) => daysBetween(r.date, today) < 14).map((r) => r.playerId),
  );
  const reserves = g.roster.filter((p) => p.squad === 'reserve');
  const active = g.roster.filter((p) => p.squad !== 'reserve');
  const good = reserves
    .filter((p) => {
      const s = p.reserveStats;
      return (
        s &&
        p.condition >= 70 &&
        (p.pos === 'P'
          ? s.outs >= 12 && (s.er * 27) / s.outs <= 3.5
          : s.ab >= 12 && s.h / s.ab >= 0.3)
      );
    })
    .sort((a, b) => overall(b) - overall(a));
  const poor = active.filter(
    (p) =>
      p.condition < 55 ||
      (p.pos === 'P'
        ? p.stats.outs >= 18 && (p.stats.er * 27) / p.stats.outs >= 6
        : p.stats.ab >= 20 && p.stats.h / p.stats.ab < 0.2),
  );
  for (const [target, candidates] of [
    ['first', good],
    ['reserve', poor],
  ] as const) {
    const p = candidates.find((p) => !recent.has(p.id));
    if (!p) continue;
    const replacement = (target === 'first' ? active : reserves)
      .filter((x) => x.pos === p.pos)
      .sort((a, b) =>
        target === 'first'
          ? overall(a) * a.condition - overall(b) * b.condition
          : overall(b) * b.condition - overall(a) * a.condition,
      )
      .find((x) => !squadMoveError(g, p.id, target, x.id));
    if (!replacement && squadMoveError(g, p.id, target)) continue;
    const coach = g.staff.find((c) => c.role === (p.pos === 'P' ? '투수' : '타격')) || g.staff[0];
    if (!coach) continue;
    const reason =
      target === 'first'
        ? `2군에서 ${statsText(p, true)}를 기록했습니다. 1군에서 기회를 줄 것을 추천합니다.`
        : `${statsText(p)} · 컨디션 ${Math.round(p.condition)}%. 2군에서 훈련과 회복 시간을 주는 것을 추천합니다.`;
    const id = `coach-${today}-${p.id}-${target}`;
    g.coachRecommendations.unshift({
      id,
      playerId: p.id,
      replacementId: replacement?.id,
      target,
      date: today,
      status: 'pending',
      reason,
    });
    postNews(
      g,
      `${p.name} · ${target === 'first' ? '1군 기용 추천' : '2군 재정비 추천'}`,
      reason,
      'training',
      {
        playerId: p.id,
        actionView: 'reserves',
        sender: {
          name: coach.name,
          role: target === 'first' ? '2군 선수 관찰 보고' : '1군 선수 평가 보고',
        },
        report: {
          facts: [
            { label: '등록 제안', value: target === 'first' ? '2군 → 1군' : '1군 → 2군' },
            { label: '맞교체 선수', value: replacement?.name || '등록 인원 내 이동' },
          ],
          players: [{ id: p.id, name: p.name, detail: reason }],
        },
      },
    );
  }
  g.coachRecommendations = g.coachRecommendations.slice(0, 40);
}
export function coachReportAction(g: GameState, a: Record<string, unknown>) {
  if (a.type !== 'coachRecommendation') return null;
  const report = g.coachRecommendations?.find((r) => r.id === a.id);
  if (!report || report.status !== 'pending') throw new Error('처리할 코치 보고가 없습니다.');
  if (typeof a.accept !== 'boolean') throw new Error('보고 수락 여부를 선택해 주세요.');
  if (a.accept) {
    if (daysBetween(report.date, gameDate(g)) > 14)
      throw new Error('14일이 지난 보고입니다. 현재 선수단을 직접 확인해 주세요.');
    const p = g.roster.find((p) => p.id === report.playerId);
    if (!p || (p.squad || 'first') === report.target)
      throw new Error('선수 등록 상태가 보고 이후 변경됐습니다.');
    changeSquad(g, { id: p.id, value: report.target, replaceId: report.replacementId });
  }
  report.status = a.accept ? 'accepted' : 'dismissed';
  return g;
}
