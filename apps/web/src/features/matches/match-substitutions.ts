import type { AutomaticPitchingChange, MatchChange, Result } from '@dugout/shared/types';

export type MatchSubstitution = {
  id: string;
  cursor: number;
  inning: number;
  half: number;
  club: string;
  own: boolean;
  from: string;
  to: string;
  reason: string;
  role?: string;
};
const roles = { closer: '마무리', setup: '필승조', chase: '추격조', relief: '중간 계투' };
function reason(change?: AutomaticPitchingChange) {
  if (!change) return '투수 운용 계획에 따른 자동 교체입니다.';
  const innings = `${Math.floor(change.outs / 3)}${change.outs % 3 === 1 ? '⅓' : change.outs % 3 === 2 ? '⅔' : ''}`;
  switch (change.reason) {
    case 'protect-closer':
      return `${Math.abs(change.lead)}점 차로 벌어져 마무리 투수의 체력을 아낍니다.`;
    case 'fatigue':
      return `경기 체력이 ${change.energy ?? 0}%로 떨어져 교체합니다.`;
    case 'save':
      return `${change.lead}점 리드를 지키기 위해 마무리를 투입합니다.`;
    case 'runs':
      return `${change.runs}실점으로 선발을 내리고 불펜을 가동합니다.`;
    case 'starter-limit':
      return `선발이 ${innings}이닝을 소화해 불펜에 마운드를 넘깁니다.`;
    case 'relief-limit':
      return `${innings}이닝을 맡은 계투를 다음 투수로 교체합니다.`;
  }
}

/** Only inspect plays already on screen. Never announce a future pitcher or result. */
export function matchSubstitutions(
  result: Result,
  cursor: number,
  ownClub: string,
  manual: MatchChange[] = [],
): MatchSubstitution[] {
  const pitchers = result.replayTeams?.map((team) => team.defense.P) || [];
  const names = new Map(
    result.replayTeams?.flatMap((team) => team.players.map((p) => [p.id, p.name] as const)) || [],
  );
  const events: MatchSubstitution[] = [];
  for (let index = 0; index < Math.min(Math.max(cursor, 0), result.log.length); index++) {
    const row = result.log[index],
      play = row.play;
    if (!play) continue;
    const side = 1 - row.half,
      club = side === 0 ? result.away : result.home;
    const from = play.pitchingChange?.from || pitchers[side];
    pitchers[side] = play.pitcher;
    if (!from || from === play.pitcher) continue;
    if (
      club === ownClub &&
      manual.some((change) => change.cursor === index && change.pitcher === play.pitcher)
    )
      continue;
    events.push({
      id: `${club}:${index}:${from}:${play.pitcher}`,
      cursor: index,
      inning: row.inning,
      half: row.half,
      club,
      own: club === ownClub,
      from: names.get(from) || '이전 투수',
      to: names.get(play.pitcher) || '새 투수',
      reason: reason(play.pitchingChange),
      role: play.pitchingChange && roles[play.pitchingChange.role],
    });
  }
  return events;
}
