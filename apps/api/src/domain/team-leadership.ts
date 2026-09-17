import type { GameState } from '@dugout/shared/types';

/** 주장단은 시즌 중에도 한 번에 한 명씩만 지정하며 선수단 사기에 반영한다. */
export function teamLeadershipAction(g: GameState, action: Record<string, unknown>) {
  if (action.type !== 'setCaptain') return null;
  if (g.liveMatch) throw new Error('경기 중에는 주장단을 바꿀 수 없습니다.');
  const captain = String(action.captain || '');
  const vice = action.viceCaptain ? String(action.viceCaptain) : undefined;
  const members = new Map(g.roster.filter((p) => p.club === g.club).map((p) => [p.id, p]));
  if (!members.has(captain)) throw new Error('주장을 선수단에서 선택해 주세요.');
  if (vice && (!members.has(vice) || vice === captain)) throw new Error('부주장을 확인해 주세요.');
  g.captain = captain;
  g.viceCaptain = vice;
  g.news.push({
    id: `leadership-${g.year}-${g.day}-${captain}`,
    day: g.day,
    title: '주장단을 선임했습니다',
    body: `${members.get(captain)!.name} 선수를 주장${vice ? `, ${members.get(vice)!.name} 선수를 부주장` : ''}으로 선임했습니다. 선수단의 공식 리더십 기록에 반영됩니다.`,
    kind: 'club',
    read: false,
  });
  return g;
}
