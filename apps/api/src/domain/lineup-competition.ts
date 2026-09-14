import type { GameState, Result, Player } from '@dugout/shared/types';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { isClubSeasonRest } from '@dugout/shared/season-status';
import {
  competitionChoices,
  competitionLine,
  type CompetitionChoice,
  type CompetitionPlayer,
  type LineupCompetition,
} from '@dugout/shared/lineup-competition';
import { matchBoxScore } from '@dugout/shared/match-box-score';
import { overall } from '@dugout/shared/game-view';
import { playerPersonality } from '@dugout/shared/personality';
import { postNews } from './club-dynamics';
import { managerRelationshipReaction } from './manager-journey';
const limited = (n: number) => Math.max(0, Math.min(100, n));
const participant = (p: Player): CompetitionPlayer => ({
  id: p.id,
  name: p.name,
  starts: 0,
  ab: 0,
  h: 0,
  hr: 0,
});
function reaction(g: GameState, id: string, delta: number, reason: string, trust = 0) {
  const p = g.roster.find((p) => p.id === id);
  if (p?.mood) {
    p.mood.value = limited(p.mood.value + delta);
    p.mood.reason = reason;
  }
  if (p && trust) managerRelationshipReaction(g, id, trust);
}
function close(g: GameState, c: LineupCompetition, outcome: string, kept?: boolean) {
  c.status = 'resolved';
  c.resolved = gameDate(g);
  c.outcome = outcome;
  c.kept = kept;
  for (const n of g.news.filter((n) => n.competitionId === c.id && n.choiceKind && !n.choice)) {
    n.choice = 'resolved';
    n.response = outcome;
  }
  if (g.club !== c.club || g.managerCareer?.status !== 'employed') return;
  postNews(g, `${c.veteran.name}·${c.prospect.name} 주전 경쟁 정리`, outcome, 'morale', {
    id: `competition-result:${c.id}`,
    competitionId: c.id,
    playerId: c.prospect.id,
    priority: 'story',
    report: {
      facts: [
        { label: '평가 경기', value: `${c.games}/6경기` },
        { label: '베테랑 출전', value: `선발 ${c.veteran.starts}경기` },
        { label: '유망주 출전', value: `선발 ${c.prospect.starts}경기` },
      ],
      sections: [
        {
          title: '실제 기용과 성적',
          body: [competitionLine(c.veteran), competitionLine(c.prospect)].join('\n'),
        },
        { title: '선수단 반응', body: outcome },
      ],
    },
  });
}
export function prepareCompetitions(g: GameState) {
  for (const c of g.engagement?.competitions || []) {
    if (c.status === 'resolved') continue;
    if (c.club !== g.club || g.managerCareer?.status === 'unemployed')
      close(g, c, '소속 구단이 바뀌어 이전 구단의 주전 경쟁을 정리했습니다.');
    else if (![c.veteran.id, c.prospect.id].every((id) => g.roster.some((p) => p.id === id)))
      close(
        g,
        c,
        '선수 이동으로 두 선수의 경쟁을 종료했습니다. 출전 약속 불이행으로 처리하지 않습니다.',
      );
    else if (isClubSeasonRest(g))
      close(
        g,
        c,
        `우리 팀 시즌 일정이 끝나 ${c.games}경기까지의 기용 기록으로 경쟁을 정리했습니다. 남은 경기 약속에 불이행 불이익을 주지 않습니다.`,
      );
  }
}
export function competitionAction(g: GameState, a: Record<string, unknown>) {
  if (a.type !== 'respondCompetition') return null;
  if (g.liveMatch) throw new Error('경기를 마친 뒤 선수단 방침을 정해 주세요.');
  if (g.managerCareer?.status !== 'employed' || g.managerCareer.vacationUntil)
    throw new Error('구단에서 지휘 중일 때 주전 경쟁에 답변할 수 있습니다.');
  prepareCompetitions(g);
  const c = g.engagement?.competitions?.find((c) => c.id === a.id && c.club === g.club);
  if (
    !c ||
    c.status !== 'decision' ||
    typeof a.choice !== 'string' ||
    !Object.hasOwn(competitionChoices, a.choice)
  )
    throw new Error('답변할 주전 경쟁과 선택지를 확인해 주세요.');
  const veteran = g.roster.find((p) => p.id === c.veteran.id)!,
    prospect = g.roster.find((p) => p.id === c.prospect.id)!;
  const choice = a.choice as CompetitionChoice;
  if (
    choice === 'mediate' &&
    !g.roster.some(
      (p) => p.id === c.mediator?.id && p.squad !== 'reserve' && !p.injury && !p.internationalDuty,
    )
  )
    throw new Error('중재 선수가 현재 선수단에 없습니다. 다른 방침을 선택해 주세요.');
  c.choice = choice;
  c.status = 'trial';
  let response = competitionChoices[choice].detail;
  if (choice === 'backProspect') {
    veteran.mood!.role = 'rotation';
    reaction(g, veteran.id, -3, '감독이 유망주 중심의 기용을 발표해 아쉬움', -2);
    reaction(g, prospect.id, 2, '감독의 선발 기용 약속을 받음', 1);
  } else if (choice === 'compete') {
    reaction(g, veteran.id, 2, '공개 경쟁에서 다시 선발 기회를 기다림', 1);
    reaction(g, prospect.id, 1, '주전 경쟁의 기회를 얻음', 1);
  } else {
    const mediator = g.roster.find((p) => p.id === c.mediator!.id)!;
    c.mediation =
      playerPersonality(mediator).loyalty + mediator.age >=
      playerPersonality(veteran).stubbornness + 25;
    response = `${mediator.name}의 중재 ${c.mediation ? '수용' : '난항'}. ${competitionChoices.mediate.detail}`;
    reaction(
      g,
      veteran.id,
      c.mediation ? 2 : -1,
      c.mediation
        ? '고참의 중재를 받아들이고 실제 기용을 지켜보기로 함'
        : '중재를 들었지만 출전 기회에 대한 아쉬움이 남음',
    );
  }
  for (const n of g.news.filter((n) => n.competitionId === c.id && n.choiceKind && !n.choice)) {
    n.choice = choice;
    n.read = true;
    n.response = response;
  }
  postNews(g, `${competitionChoices[choice].label} · 다음 6경기`, response, 'morale', {
    competitionId: c.id,
    playerId: prospect.id,
  });
  return g;
}
export function recordCompetitionMatch(g: GameState, result: Result) {
  if (
    result.friendly ||
    g.managerCareer?.status !== 'employed' ||
    ![result.home, result.away].includes(g.club)
  )
    return;
  const e = g.engagement;
  if (!e) return;
  const side = result.home === g.club ? 1 : 0,
    starters = new Set(result.replayTeams?.[side]?.lineup || []),
    box = matchBoxScore(result)[side];
  for (const c of e.competitions || []) {
    if (c.club !== g.club || c.status !== 'trial' || c.observed.includes(result.id)) continue;
    c.observed = [...c.observed, result.id].slice(-8);
    const players = [c.veteran, c.prospect].map((s) => g.roster.find((p) => p.id === s.id));
    if (players.some((p) => !p)) {
      close(g, c, '선수 이동으로 주전 경쟁을 종료했습니다.');
      continue;
    }
    if (players.some((p) => p!.injury || p!.internationalDuty)) continue;
    c.games++;
    for (const entry of [c.veteran, c.prospect]) {
      if (starters.has(entry.id)) entry.starts++;
      const b = box.batters.find((b) => b.id === entry.id);
      if (b) {
        entry.ab += b.ab;
        entry.h += b.h;
        entry.hr += b.hr;
      }
    }
    if (c.games < 6) continue;
    const target = competitionChoices[c.choice!],
      kept = c.veteran.starts >= target.veteran && c.prospect.starts >= target.prospect;
    const text = kept
      ? '약속한 선발 기회를 지켰습니다.'
      : '약속한 선발 기회를 모두 주지는 못했습니다.';
    for (const role of ['veteran', 'prospect'] as const) {
      if (!target[role]) continue;
      const met = c[role].starts >= target[role];
      reaction(
        g,
        c[role].id,
        met ? 4 : -6,
        met
          ? '주전 경쟁에서 감독이 약속한 기회를 지킴'
          : '주전 경쟁에서 약속한 선발 기회를 받지 못함',
        met ? 2 : -3,
      );
    }
    let performance = '';
    if (c.veteran.ab >= 6 && c.prospect.ab >= 6) {
      const best =
        c.veteran.h / c.veteran.ab > c.prospect.h / c.prospect.ab
          ? c.veteran
          : c.veteran.h / c.veteran.ab < c.prospect.h / c.prospect.ab
            ? c.prospect
            : undefined;
      if (best) {
        reaction(g, best.id, 2, '주전 경쟁 기간의 타격 성적으로 자신감 상승');
        performance = ` ${best.name}의 경쟁 기간 타율이 더 높았습니다.`;
      }
    }
    if (c.choice === 'backProspect' && c.prospect.h >= 3 && kept) {
      reaction(g, c.veteran.id, 1, '기회를 받은 유망주의 실제 안타를 보며 팀 기여를 인정');
      performance += ` ${c.prospect.name}의 ${c.prospect.h}안타를 베테랑도 팀 기여로 받아들였습니다.`;
    }
    close(g, c, `${text}${performance} 선발 명단은 감독이 계속 정합니다.`, kept);
  }
  if (
    g.managerCareer.vacationUntil ||
    isClubSeasonRest(g) ||
    (e.competitions || []).some((c) => c.status !== 'resolved')
  )
    return;
  for (const story of e.prospects.filter(
    (s) => s.club === g.club && s.active && s.starts >= 2 && starters.has(s.id),
  )) {
    const prospect = g.roster.find((p) => p.id === story.id);
    if (!prospect || prospect.pos === 'P' || prospect.age > 23) continue;
    const veterans = g.roster
      .filter(
        (p) =>
          p.id !== prospect.id &&
          p.age >= 28 &&
          p.pos === prospect.pos &&
          p.squad !== 'reserve' &&
          !p.injury &&
          !p.internationalDuty &&
          p.condition >= 65 &&
          ['core', 'regular'].includes(p.mood?.role || '') &&
          !p.mood?.promise &&
          (p.mood?.recent.length || 0) >= 3 &&
          p.mood!.recent.slice(-3).every((v) => !v) &&
          !g.news.some((n) => n.playerId === p.id && n.choiceKind && !n.choice) &&
          !(e.competitions || []).some(
            (c) =>
              c.club === g.club &&
              c.veteran.id === p.id &&
              daysBetween(c.created, gameDate(g)) < 42,
          ),
      )
      .sort((a, b) => overall(b) - overall(a));
    const veteran = veterans[0];
    if (!veteran) continue;
    const mediator = g.roster
      .filter(
        (p) =>
          p.id !== veteran.id &&
          p.id !== prospect.id &&
          p.age >= 30 &&
          p.squad !== 'reserve' &&
          !p.injury &&
          !p.internationalDuty,
      )
      .sort(
        (a, b) => playerPersonality(b).loyalty + b.age - (playerPersonality(a).loyalty + a.age),
      )[0];
    const c: LineupCompetition = {
      id: `competition:${g.club}:${result.id}:${veteran.id}`,
      club: g.club,
      created: gameDate(g),
      status: 'decision',
      veteran: participant(veteran),
      prospect: participant(prospect),
      ...(mediator ? { mediator: { id: mediator.id, name: mediator.name } } : {}),
      evidence: `같은 포지션의 ${prospect.name}은 육성 지명 후 선발 ${story.starts}경기. ${veteran.name}은 최근 팀 3경기에 출전하지 못했습니다.`,
      games: 0,
      observed: [],
    };
    e.competitions = [...(e.competitions || []), c].slice(-12);
    postNews(
      g,
      `${veteran.name}, 주전 경쟁 방침을 묻습니다`,
      `${c.evidence}\n유망주 기용을 이어갈지, 두 선수에게 경쟁 기회를 줄지 결정해 주세요.`,
      'morale',
      {
        id: `competition-open:${c.id}`,
        playerId: veteran.id,
        competitionId: c.id,
        choiceKind: 'lineupCompetition',
      },
    );
    break;
  }
}
