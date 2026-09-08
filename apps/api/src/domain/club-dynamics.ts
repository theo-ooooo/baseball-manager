import type { GameState, Result, WorldCatalog, NewsItem } from '@dugout/shared/types';
import { overall, hash, createGameView, money } from '@dugout/shared/game-view';
import { gameDate, dateLabel } from '@dugout/shared/calendar';
const limit = (n: number) => Math.max(0, Math.min(100, n));
export function postNews(
  g: GameState,
  title: string,
  body: string,
  kind = 'club',
  extra: Partial<NewsItem> = {},
) {
  const item: NewsItem = {
    id: `${g.year}-${g.day}-${hash(title + body)}`,
    year: g.year,
    day: g.day,
    date: gameDate(g),
    title,
    body,
    kind,
    read: false,
    ...extra,
  };
  if (g.news.some((n) => n.id === item.id)) return;
  g.news = [item, ...g.news];
  const pending = g.news.filter((n) => n.choiceKind && !n.choice),
    rest = g.news.filter((n) => !n.choiceKind || n.choice);
  g.news = [...pending, ...rest.slice(0, 100 - pending.length)].sort(
    (a, b) => (b.year || g.year) - (a.year || g.year) || b.day - a.day,
  );
}
export function prepareDynamics(g: GameState) {
  const ranked = [...g.roster].sort((a, b) => overall(b) - overall(a));
  for (const p of g.roster)
    p.mood ??= {
      value: 65,
      role:
        p.squad === 'reserve'
          ? 'prospect'
          : p.pos === 'P'
            ? 'rotation'
            : g.lineup.includes(p.id)
              ? ranked.indexOf(p) < 5
                ? 'core'
                : 'regular'
              : 'rotation',
      reason: '새 감독 체제에 적응 중',
      recent: [],
    };
}
export function matchMorale(g: GameState, res: Result) {
  prepareDynamics(g);
  if (res.friendly) return;
  const side = res.home === g.club ? 1 : 0,
    team = res.replayTeams?.[side],
    played = new Set(team ? [...team.lineup, team.defense.P] : [...g.lineup, g.starter]);
  const win = (side ? res.homeScore : res.awayScore) > (side ? res.awayScore : res.homeScore),
    draw = res.homeScore === res.awayScore;
  for (const p of g.roster) {
    const m = p.mood!,
      appeared = played.has(p.id);
    m.recent = [...m.recent, appeared].slice(-12);
    if (appeared) m.lastPlayedDay = g.day;
    const target =
      p.pos === 'P' ? 0.18 : { core: 0.75, regular: 0.6, rotation: 0.3, prospect: 0.05 }[m.role];
    const ratio = m.recent.filter(Boolean).length / m.recent.length;
    const shortage = m.recent.length >= 6 && ratio < target;
    m.value = limit(
      m.value + (draw ? 0 : win ? 1.3 : -1.3) + (shortage ? -2.4 : appeared ? 0.8 : 0),
    );
    m.reason = shortage
      ? '기대한 출전 기회보다 적음'
      : win
        ? '팀 승리로 자신감 상승'
        : draw
          ? '다음 경기를 준비 중'
          : '패배로 자신감 하락';
  }
}
export function dailyReports(g: GameState, world: WorldCatalog) {
  prepareDynamics(g);
  const view = createGameView(world);
  for (const p of g.roster) {
    const m = p.mood!;
    if (g.training === 'rest' && p.condition < 70) m.value = limit(m.value + 0.5);
    if (m.promise && g.day >= m.promise.due) {
      const completed = p.stats.g - m.promise.startGames >= m.promise.games;
      m.value = limit(m.value + (completed ? 8 : -16));
      m.reason = completed ? '감독이 출전 약속을 지킴' : '출전 약속이 지켜지지 않음';
      postNews(
        g,
        `${p.name} · 출전 약속 ${completed ? '이행' : '불이행'}`,
        `${m.promise.games}경기 출전 약속, 실제 ${p.stats.g - m.promise.startGames}경기. ${m.reason}.`,
        'morale',
        { playerId: p.id },
      );
      m.promise = undefined;
    }
    if (
      m.value < 45 &&
      !m.promise &&
      g.day - (m.lastConcernDay ?? -1000) >= 28 &&
      !g.news.some((n) => n.playerId === p.id && n.choiceKind && !n.choice)
    ) {
      m.lastConcernDay = g.day;
      postNews(
        g,
        `${p.name}, 감독 면담 요청`,
        `현재 사기 ${Math.round(m.value)} · ${m.reason}. 선수는 자신의 역할과 출전 계획을 듣고 싶어 합니다.`,
        'morale',
        { playerId: p.id, choiceKind: 'playingTime' },
      );
    }
  }
  if (g.day % 7 === 0) {
    const unhappy = g.roster.filter((p) => p.mood!.value < 45),
      tired = g.roster.filter((p) => p.condition < 55);
    postNews(
      g,
      '주간 선수단 보고',
      `평균 사기 ${Math.round(g.roster.reduce((s, p) => s + p.mood!.value, 0) / g.roster.length)} · 불만 선수 ${unhappy.length}명 · 피로 누적 ${tired.length}명. 전술 숙련도 ${Math.round(g.tacticFamiliarity || 0)}%.${
        unhappy.length
          ? ' 면담 대상: ' +
            unhappy
              .map((p) => p.name)
              .slice(0, 5)
              .join(', ')
          : ''
      }`,
      'training',
      {
        actionView: 'squad',
        sender: { name: '코칭 스태프', role: '주간 선수단 점검' },
        report: {
          purpose: 'squadReview',
          facts: [
            {
              label: '평균 사기',
              value: String(
                Math.round(g.roster.reduce((sum, p) => sum + p.mood!.value, 0) / g.roster.length),
              ),
            },
            { label: '면담 필요', value: `${unhappy.length}명` },
            { label: '피로 누적', value: `${tired.length}명` },
            { label: '전술 숙련', value: `${Math.round(g.tacticFamiliarity || 0)}%` },
          ],
          sections: [
            {
              title: '다음 주 운용 의견',
              body: tired.length
                ? '피로가 누적된 선수의 선발 출전을 줄이고 2군 선수와 교체를 검토하세요. 출전 약속이 있는 선수는 약속 기한과 실제 출전 수를 함께 확인하세요.'
                : '선수단 컨디션은 안정적입니다. 주요 선수의 연속 출전과 유망주의 기회를 함께 관리하세요.',
            },
          ],
          players: [...new Map([...unhappy, ...tired].map((p) => [p.id, p])).values()]
            .slice(0, 12)
            .map((p) => ({
              id: p.id,
              name: p.name,
              detail: `사기 ${Math.round(p.mood!.value)} · 컨디션 ${Math.round(p.condition)}% · ${p.mood!.reason}`,
            })),
        },
      },
    );
  }
  if (g.day % 14 === 0) {
    const expiring = g.roster.filter((p) => p.years === 1);
    if (expiring.length)
      postNews(
        g,
        '계약 만료 예정 선수 점검',
        `시즌 종료 시 계약 만료 ${expiring.length}명: ${expiring
          .slice(0, 8)
          .map((p) => p.name)
          .join(', ')}. 재계약 여부를 결정하세요.`,
        'contract',
        {
          actionView: 'agents',
          sender: { name: '구단 계약 담당자', role: '선수 계약 관리' },
          report: {
            purpose: 'contractReview',
            facts: [
              { label: '만료 예정', value: `${expiring.length}명` },
              {
                label: '현재 연봉 합계',
                value: money(expiring.reduce((sum, p) => sum + p.salary, 0)),
              },
            ],
            sections: [
              {
                title: '감독님께 요청드립니다',
                body: '아래 선수들의 계약이 이번 시즌을 끝으로 만료됩니다. 선수별 재계약 협상 버튼으로 에이전트에게 조건을 제안할 수 있습니다. 답변을 받은 뒤 조건을 조정하고 최종 서명을 진행하세요.',
              },
              {
                title: '검토 기준',
                body: '주전 활용 계획, 최근 출전과 성장 기록, 다음 시즌 연봉 부담을 함께 확인하세요. 제안만 보낸 상태에서는 계약이 연장되지 않습니다.',
              },
            ],
            players: expiring.map((p) => ({
              id: p.id,
              name: p.name,
              salary: p.salary,
              years: p.years,
              detail: `${p.age}세 · ${p.pos} · ${p.squad === 'reserve' ? '2군' : '1군'} · ${p.stats.g}경기 출전`,
            })),
          },
        },
      );
  }
  const today = view.ownFixtures(g),
    previous = view.ownFixtures(g, g.day - 1),
    first = today[0];
  if (
    first &&
    (!previous.length || !previous.some((f) => f.home === first.home && f.away === first.away))
  ) {
    const opponent = first.home === g.club ? first.away : first.home,
      roster = view.rosterFor(g, opponent),
      batter = roster.filter((p) => p.pos !== 'P').sort((a, b) => overall(b) - overall(a))[0],
      row = g.standings[first.league].find((s) => s.club === opponent)!;
    postNews(
      g,
      `${view.getClub(opponent).name} · 시리즈 분석`,
      `${dateLabel(g)} ${first.home === g.club ? '홈' : '원정'} 시리즈 시작. 상대 ${row.w}승 ${row.l}패, 최근 ${row.form.join(' ') || '시즌 시작 전'}. 주요 타자 ${batter?.name || '확인 중'}. 선발 투수 컨디션과 수비 배치를 점검하세요.`,
      'scout',
      {
        actionView: 'squad',
        sender: { name: '전력 분석팀', role: '상대 시리즈 브리핑' },
        report: {
          facts: [
            { label: '상대 전적', value: `${row.w}승 ${row.l}패` },
            { label: '최근 경기', value: row.form.join(' · ') || '시즌 시작 전' },
            { label: '주요 타자', value: batter?.name || '확인 중' },
          ],
          sections: [
            {
              title: '경기 준비',
              body: '선발 투수의 피로와 불펜 역할을 확인하세요. 경기 프리뷰에서 상대 명단을 살펴본 뒤 수비 위치와 공격 성향을 조정할 수 있습니다.',
            },
          ],
        },
      },
    );
  }
}
export function dynamicsAction(g: GameState, a: Record<string, unknown>): GameState | null {
  prepareDynamics(g);
  if (a.type === 'readAllNews') {
    for (const n of g.news) n.read = true;
    return g;
  }
  if (a.type === 'readNews') {
    const n = g.news.find((n) => n.id === a.id);
    if (n) n.read = true;
    return g;
  }
  if (a.type === 'respondNews') {
    const n = g.news.find((n) => n.id === a.id),
      choice = String(a.choice);
    if (!n?.choiceKind || n.choice || !['promise', 'explain'].includes(choice))
      throw new Error('답변할 면담과 선택지를 확인해 주세요.');
    const p = g.roster.find((p) => p.id === n.playerId);
    if (!p) throw new Error('현재 소속 선수가 아닙니다.');
    const m = p.mood!;
    if (choice === 'promise') {
      const games = p.pos === 'P' ? 1 : 4;
      m.promise = { due: g.day + 14, games, startGames: p.stats.g };
      m.value = limit(m.value + 6);
      m.reason = `2주 내 ${games}경기 출전 약속을 믿고 기다림`;
    } else {
      m.value = limit(m.value + 2);
      m.reason = '감독의 선수단 운용 방침을 들음';
    }
    n.choice = choice;
    n.read = true;
    n.response = m.reason;
    postNews(g, `${p.name} 면담 완료`, m.reason, 'morale', { playerId: p.id });
    return g;
  }
  return null;
}
