import type { GameState, WorldCatalog, Fixture } from '@dugout/shared/types';
const DAY = 86400000;
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(date + 'T12:00:00Z') + days * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
export const gameDate = (g: GameState, day = g.day) =>
  addDays(g.calendar?.openingDate || `${g.year}-03-28`, day);
export const dateLabel = (g: GameState, day = g.day) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(gameDate(g, day) + 'T12:00:00Z'));
export function roundPairs(ids: string[], round: number) {
  const list = [...ids];
  if (list.length % 2) list.push('bye');
  const n = list.length,
    turn = round % (n - 1),
    cycle = Math.floor(round / (n - 1));
  for (let i = 0; i < turn; i++) list.splice(1, 0, list.pop()!);
  const pairs: string[][] = [];
  for (let i = 0; i < n / 2; i++) {
    const pair = [list[i], list[n - 1 - i]];
    if ((turn + i + cycle) % 2) pair.reverse();
    if (!pair.includes('bye')) pairs.push(pair);
  }
  return pairs;
}
const winter = new Set(['lmp', 'lidom', 'lvbp', 'lbprc', 'abl']);
export function createCalendarView(world: WorldCatalog) {
  const cache = new Map<string, Fixture[]>(),
    dateCache = new Map<string, Map<string, Fixture[]>>();
  const official = (g: GameState, lid: string) =>
    g.mode === 'full' &&
    g.year === world.year &&
    !g.calendar?.remaining &&
    (world.fixtures || []).some((f) => f.league === lid);
  function opening(g: GameState, lid: string) {
    if (official(g, lid))
      return (world.fixtures || [])
        .filter((f) => f.league === lid)
        .map((f) => f.date)
        .sort()[0];
    return `${g.year}-${winter.has(lid) ? '10-15' : '03-28'}`;
  }
  const key = (g: GameState, lid: string) =>
    `${g.year}:${g.mode}:${lid}:${g.calendar?.openingDate || ''}:${g.calendar?.startDay || 0}:${JSON.stringify(g.calendar?.remaining || {})}`;
  function fixtures(g: GameState, lid: string): Fixture[] {
    const k = key(g, lid);
    if (cache.has(k)) return cache.get(k)!;
    let result: Fixture[] = [];
    if (official(g, lid)) result = (world.fixtures || []).filter((f) => f.league === lid);
    else {
      const ids = world.clubs.filter((c) => c.league === lid).map((c) => c.id),
        league = world.leagues.find((l) => l.id === lid)!;
      const target = g.mode === 'short' ? (ids.length - 1) * 2 : league.games;
      const left = Object.fromEntries(ids.map((id) => [id, g.calendar?.remaining?.[id] ?? target]));
      let date = g.calendar?.remaining
        ? addDays(g.calendar.openingDate, g.calendar.startDay)
        : opening(g, lid);
      for (let round = 0; Object.values(left).some((n) => n > 0) && round < 500; round++) {
        const pairs = roundPairs(ids, round),
          length = g.mode === 'short' ? 2 : round === 0 ? 2 : 3;
        for (let n = 0; n < length; n++) {
          while (new Date(date + 'T12:00:00Z').getUTCDay() === 1) date = addDays(date, 1);
          for (const [home, away] of pairs) {
            if (left[home] <= 0 || left[away] <= 0) continue;
            left[home]--;
            left[away]--;
            result.push({
              id: `generated-${g.year}-${lid}-${date}-${home}-${away}`,
              date,
              home,
              away,
              league: lid,
              generated: true,
            });
          }
          date = addDays(date, 1);
        }
        // A series boundary provides a travel/rest day outside the standard Monday rest.
        if (round % 2 === 1 && new Date(date + 'T12:00:00Z').getUTCDay() !== 1)
          date = addDays(date, 1);
        if (Object.values(left).filter((n) => n > 0).length < 2) break;
      }
      // Repair an uneven legacy tail without deleting any already played result.
      const stranded = Object.keys(left).find((id) => left[id] > 0);
      if (stranded)
        while (left[stranded] >= 2) {
          const index = result.findLastIndex((f) => f.home !== stranded && f.away !== stranded);
          if (index < 0) break;
          const [edge] = result.splice(index, 1);
          for (const rival of [edge.home, edge.away]) {
            while (new Date(date + 'T12:00:00Z').getUTCDay() === 1) date = addDays(date, 1);
            result.push({
              id: `generated-tail-${g.year}-${date}-${stranded}-${rival}`,
              date,
              home: stranded,
              away: rival,
              league: lid,
              generated: true,
            });
            left[stranded]--;
            date = addDays(date, 1);
          }
        }
    }
    result = [...result].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    cache.set(k, result);
    return result;
  }
  function onDate(g: GameState, lid: string, day = g.day) {
    const k = key(g, lid);
    if (!dateCache.has(k)) {
      const map = new Map<string, Fixture[]>();
      for (const f of fixtures(g, lid)) map.set(f.date, [...(map.get(f.date) || []), f]);
      dateCache.set(k, map);
    }
    return dateCache.get(k)!.get(gameDate(g, day)) || [];
  }
  function ownFixtures(g: GameState, day = g.day) {
    return onDate(g, world.clubs.find((c) => c.id === g.club)!.league, day).filter(
      (f) => f.home === g.club || f.away === g.club,
    );
  }
  function scheduleNote(g: GameState, lid = world.clubs.find((c) => c.id === g.club)!.league) {
    return official(g, lid)
      ? lid === 'kbo'
        ? '공식 편성 기반 · 최초 675경기 + 잔여 대진 45경기 · 우천 취소는 재현하지 않음'
        : '2026 공식 경기 날짜·대진 · 9월 8일 스냅샷'
      : g.calendar?.remaining
        ? '기존 결과 유지 · 남은 경기 연전 편성'
        : '게임 편성 · 연전과 휴식일 적용';
  }
  return { fixtures, onDate, ownFixtures, opening, scheduleNote };
}
export function prepareCalendar(g: GameState, world: WorldCatalog, fresh = false) {
  const view = createCalendarView(world),
    lid = world.clubs.find((c) => c.id === g.club)!.league;
  if (!g.calendar) {
    const remaining =
      !fresh && g.day > 0
        ? Object.fromEntries(
            world.clubs.map((c) => {
              const row = g.standings[c.league]?.find((s) => s.club === c.id);
              const count = world.clubs.filter((v) => v.league === c.league).length;
              return [
                c.id,
                Math.max(
                  0,
                  (g.mode === 'short'
                    ? (count - 1) * 2
                    : world.leagues.find((l) => l.id === c.league)!.games) -
                    (row ? row.w + row.l + row.d : 0),
                ),
              ];
            }),
          )
        : undefined;
    g.calendar = { openingDate: view.opening(g, lid), startDay: remaining ? g.day : 0, remaining };
    const fs = view.fixtures(g, lid);
    g.rounds = Math.max(
      g.day + 1,
      ...fs.map((f) => daysBetween(g.calendar!.openingDate, f.date) + 1),
    );
  }
}
