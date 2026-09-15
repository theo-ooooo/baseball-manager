import type { GameState, WorldCatalog } from '@dugout/shared/types';
import { createGameView } from '@dugout/shared/game-view';
import { gameDate } from '@dugout/shared/calendar';
import { MAX_CLUB_MOMENTS, type ClubSeasonMemory } from '@dugout/shared/club-legacy';
export function recordClubSeason(g: GameState, world: WorldCatalog) {
  if (g.phase !== 'finished' || g.managerCareer?.status === 'unemployed') return;
  const legacy = (g.clubLegacy ??= { seasons: [], moments: [] });
  if (legacy.seasons.some((s) => s.club === g.club && s.year === g.year)) return;
  const table = createGameView(world).standings(g),
    rank = table.findIndex((s) => s.club === g.club) + 1,
    row = table[rank - 1];
  if (!row || !(row.w + row.l + row.d)) return;
  const bat = g.roster
    .filter((p) => p.pos !== 'P' && p.stats.ab > 0)
    .sort(
      (a, b) =>
        b.stats.hr * 4 + b.stats.rbi + b.stats.h - (a.stats.hr * 4 + a.stats.rbi + a.stats.h) ||
        a.id.localeCompare(b.id),
    )[0];
  const pitch = g.roster
    .filter((p) => p.pos === 'P' && p.stats.outs > 0)
    .sort(
      (a, b) =>
        b.stats.wins * 10 + b.stats.k - (a.stats.wins * 10 + a.stats.k) || a.id.localeCompare(b.id),
    )[0];
  const heroes: ClubSeasonMemory['heroes'] = [];
  if (bat)
    heroes.push({
      id: bat.id,
      name: bat.name,
      role: 'bat',
      line: `${bat.stats.hr}홈런 · ${bat.stats.rbi}타점 · ${bat.stats.h}안타`,
    });
  if (pitch)
    heroes.push({
      id: pitch.id,
      name: pitch.name,
      role: 'pitch',
      line: `${pitch.stats.wins}승 · ${pitch.stats.k}탈삼진 · 평균자책점 ${((pitch.stats.er * 27) / pitch.stats.outs).toFixed(2)}`,
    });
  legacy.seasons.push({
    club: g.club,
    year: g.year,
    manager: g.manager,
    rank,
    w: row.w,
    l: row.l,
    d: row.d,
    champion: g.champion,
    heroes,
  });
  // Compact snapshots survive next season and manager moves; never copy whole match logs.
  legacy.seasons = legacy.seasons.slice(-100);
}
export function clubLegacyAction(g: GameState, a: Record<string, unknown>): GameState | null {
  if (!['pinClubMoment', 'removeClubMoment'].includes(String(a.type))) return null;
  if (g.liveMatch) throw new Error('진행 중인 경기를 마친 뒤 기록실을 편집해 주세요.');
  const legacy = (g.clubLegacy ??= { seasons: [], moments: [] });
  if (a.type === 'removeClubMoment') {
    legacy.moments = legacy.moments.filter((m) => !(m.id === a.id && m.club === g.club));
    return g;
  }
  const r = g.history.find(
    (r) => r.id === a.id && !r.friendly && (r.home === g.club || r.away === g.club),
  );
  if (!r) throw new Error('우리 구단이 치른 공식 경기를 선택해 주세요.');
  const existing = legacy.moments.find((m) => m.club === g.club && m.id === r.id);
  if (!existing && legacy.moments.filter((m) => m.club === g.club).length >= MAX_CLUB_MOMENTS)
    throw new Error(
      `구단별로 ${MAX_CLUB_MOMENTS}경기까지 보관할 수 있습니다. 기존 경기를 뺀 뒤 추가해 주세요.`,
    );
  if (!existing && legacy.moments.length >= 120)
    throw new Error('커리어 보관 한도에 도달했습니다. 기존 기록을 정리해 주세요.');
  const caption = String(a.caption ?? '').trim();
  if (caption.length > 80) throw new Error('경기 제목은 80자 이내로 적어 주세요.');
  const memory = {
    id: r.id,
    club: g.club,
    date: r.date || gameDate(g, r.day),
    home: r.home,
    away: r.away,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    mvp: r.mvp,
    post: !!r.post,
    caption: caption || '기억하고 싶은 경기',
  };
  if (existing) Object.assign(existing, memory);
  else legacy.moments.push(memory);
  return g;
}
