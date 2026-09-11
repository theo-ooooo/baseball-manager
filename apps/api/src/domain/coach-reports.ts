import type { GameState, Player } from '@dugout/shared/types';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { isAvailable } from '@dugout/shared/long-term';
import { overall } from '@dugout/shared/game-view';
import { squadMoveError } from '@dugout/shared/roster-rules';
import { postNews } from './club-dynamics';
import { changeSquad } from './roster-moves';
import { isClubSeasonRest } from '@dugout/shared/season-status';

const statsText = (p: Player, reserve = false) => {
  const s = reserve ? p.reserveStats : p.stats;
  return p.pos === 'P'
    ? `${Math.floor((s?.outs || 0) / 3)}.${(s?.outs || 0) % 3}이닝 · ERA ${s?.outs ? ((s.er * 27) / s.outs).toFixed(2) : '—'}`
    : `${s?.ab || 0}타수 · 타율 ${s?.ab ? (s.h / s.ab).toFixed(3) : '—'}`;
};
export function coachReports(g: GameState) {
  if (g.day % 7 || g.managerCareer?.status === 'unemployed' || isClubSeasonRest(g)) return;
  const today = gameDate(g);
  g.coachRecommendations ??= [];
  const recent = new Set(
    g.coachRecommendations.filter((r) => daysBetween(r.date, today) < 14).map((r) => r.playerId),
  );
  const reserves = g.roster.filter((p) => p.squad === 'reserve' && isAvailable(p));
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
  const tired = active.find(
    (p) =>
      p.condition < 55 &&
      !p.injury &&
      !g.news.some(
        (n) =>
          n.kind === 'recovery' && n.playerId === p.id && daysBetween(n.date || today, today) < 7,
      ),
  );
  if (tired)
    postNews(
      g,
      `${tired.name} · 등판·출전 후 회복 권고`,
      `${tired.name} 선수가 조금 지쳐 보입니다. 컨디션이 ${Math.round(tired.condition)}%까지 내려왔어요.\n당장 2군으로 보내기보다는 1군에 두고 다음 등판이나 선발 출전을 한 번 쉬게 해주면 좋겠습니다. 몸 상태를 회복하면 다시 기회를 주시죠.`,
      'recovery',
      {
        playerId: tired.id,
        actionView: 'squad',
        sender: { name: '수석 코치', role: '출전 부하 관리' },
      },
    );
  const poor = active.filter(
    (p) =>
      isAvailable(p) &&
      (p.pos === 'P'
        ? p.stats.g >= 3 && p.stats.outs >= 54 && (p.stats.er * 27) / p.stats.outs >= 6.5
        : p.stats.g >= 8 && p.stats.ab >= 40 && p.stats.h / p.stats.ab < 0.2),
  );
  for (const [target, candidates] of [
    ['first', good],
    ['reserve', poor],
  ] as const) {
    const p = candidates.find((p) => !recent.has(p.id));
    if (!p) continue;
    const replacement = (target === 'first' ? active : reserves)
      .filter((x) => x.pos === p.pos)
      .sort((a, b) => (target === 'first' ? overall(a) - overall(b) : overall(b) - overall(a)))
      .find((x) => !squadMoveError(g, p.id, target, x.id));
    if (!replacement && squadMoveError(g, p.id, target)) continue;
    const coach = g.staff.find((c) => c.role === (p.pos === 'P' ? '투수' : '타격')) || g.staff[0];
    if (!coach) continue;
    const reason =
      target === 'first'
        ? `감독님, ${p.name} 선수에게 1군 기회를 줘보면 어떨까요?\n2군에서 ${statsText(p, true)}를 기록했고, 지금 몸 상태도 괜찮습니다. 아직 표본이 많지는 않으니 짧게 기회를 주면서 지켜보면 좋겠습니다.`
        : `감독님, ${p.name} 선수는 잠시 2군에서 다시 준비할 시간을 주면 좋겠습니다.\n${p.stats.g}경기에서 ${statsText(p)}로, 성적 부진이 여러 경기 이어졌습니다. 피로 때문에 내리자는 뜻은 아닙니다. 기술과 경기 감각을 가다듬고 다시 경쟁하게 하시죠.`;
    const id = `coach-${today}-${p.id}-${target}`;
    const evidence = {
      category: target === 'first' ? ('promotion' as const) : ('performance' as const),
      stats: `${target === 'first' ? '2군' : '1군 시즌 누적'} · ${target === 'first' ? '' : `${p.stats.g}경기 · `}${statsText(p, target === 'first')}`,
      threshold:
        target === 'first'
          ? p.pos === 'P'
            ? '4이닝 이상 · ERA 3.50 이하'
            : '12타수 이상 · 타율 .300 이상'
          : p.pos === 'P'
            ? '3경기·18이닝 이상 · ERA 6.50 이상'
            : '8경기·40타수 이상 · 타율 .200 미만',
      condition: Math.round(p.condition),
      replacementReason: replacement
        ? target === 'first'
          ? `${replacement.name}: ${statsText(replacement)} · 컨디션 ${Math.round(replacement.condition)}%. 같은 포지션에서 전력 평가와 등록 자리를 비교해 조정하는 선수입니다. 성적 부진이나 피로만을 근거로 내리는 권고는 아닙니다.`
          : `${replacement.name}: 2군 ${statsText(replacement, true)} · 컨디션 ${Math.round(replacement.condition)}%. 같은 포지션을 보충할 등록 가능한 선수입니다.`
        : undefined,
    };
    g.coachRecommendations.unshift({
      id,
      playerId: p.id,
      replacementId: replacement?.id,
      target,
      date: today,
      status: 'pending',
      reason,
      evidence,
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
            {
              label: '판단 근거',
              value: target === 'first' ? '2군 성적 · 등록 경쟁' : '1군 성적 부진',
            },
            { label: '성적', value: evidence.stats },

            { label: '몸 상태', value: `${evidence.condition}%` },
            { label: '등록 제안', value: target === 'first' ? '2군 → 1군' : '1군 → 2군' },
            { label: '맞교체 선수', value: replacement?.name || '등록 인원 내 이동' },
          ],
          players: [{ id: p.id, name: p.name, detail: reason }],
          sections: evidence.replacementReason
            ? [
                {
                  title: '등록 자리는 이렇게 마련하면 좋겠습니다',
                  body: evidence.replacementReason,
                },
              ]
            : [],
        },
      },
    );
  }
  g.coachRecommendations = g.coachRecommendations.slice(0, 40);
}
export function coachReportAction(g: GameState, a: Record<string, unknown>) {
  if (a.type !== 'coachRecommendation') return null;
  if (isClubSeasonRest(g))
    throw new Error('우리 팀 시즌이 끝나 휴식 중입니다. 기용 추천을 적용하지 않습니다.');
  const report = g.coachRecommendations?.find((r) => r.id === a.id);
  if (!report || report.status !== 'pending') throw new Error('처리할 코치 보고가 없습니다.');
  if (typeof a.accept !== 'boolean') throw new Error('보고 수락 여부를 선택해 주세요.');
  if (a.accept) {
    if (report.target === 'reserve' && !report.evidence && report.reason.includes('컨디션'))
      throw new Error(
        '피로도만을 근거로 한 이전 보고는 보류해 주세요. 1군 휴식으로 관리할 수 있습니다.',
      );
    if (daysBetween(report.date, gameDate(g)) > 14)
      throw new Error('14일이 지난 보고입니다. 현재 선수단을 직접 확인해 주세요.');
    const p = g.roster.find((p) => p.id === report.playerId);
    if (!p || (p.squad || 'first') === report.target)
      throw new Error('선수 등록 상태가 보고 이후 변경됐습니다.');
    changeSquad(g, { id: p.id, value: report.target, replaceId: report.replacementId }, 'coach');
  }
  report.status = a.accept ? 'accepted' : 'dismissed';
  return g;
}
