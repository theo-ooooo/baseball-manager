import { draftWindow } from '@dugout/shared/draft-rules';
import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import { createGameView, hash, overall, teamBudget } from '@dugout/shared/game-view';
import { isUnemployed } from '@dugout/shared/manager-career';
import { gameDate } from '@dugout/shared/calendar';
import { prepareWorld, saveWorldPlayer, worldEvent } from './world-simulation';
import { createPlayerGenerator } from './player-generator';
import { postNews } from './club-dynamics';
export function createRookieDraft(world: WorldCatalog) {
  const view = createGameView(world),
    { makePlayer } = createPlayerGenerator(world);
  function pick(g: GameState, club: string, p: Player) {
    const d = g.draft!;
    p.club = club;
    p.squad = 'reserve';
    p.years = 3;
    if (club === g.club) {
      if (g.roster.length >= 85)
        throw new Error('선수단 정원 85명입니다. 선수를 정리하거나 지명을 포기해 주세요.');
      g.roster = [...g.roster, p];
      (g.knowledge!.players ??= []).push(p.id);
    }
    saveWorldPlayer(g, p, true);
    d.picks.push({
      club,
      playerId: p.id,
      name: p.name,
      round: Math.floor(d.cursor / d.order.length) + 1,
    });
    d.prospects = d.prospects.filter((x) => x.id !== p.id);
    d.cursor++;
    d.round = Math.floor(d.cursor / d.order.length) + 1;
    worldEvent(g, {
      kind: 'youth',
      club,
      playerId: p.id,
      text: `${view.getClub(club).short} · ${p.name} 신인 입단`,
    });
  }
  function progress(g: GameState, autoOwn = false) {
    const d = g.draft!;
    const rounds = d.rounds || 3;
    const teams = new Map(d.order.map((club) => [club, view.rosterFor(g, club)]));
    while (d.cursor < d.order.length * rounds) {
      const club = d.order[d.cursor % d.order.length];
      if (club === g.club && !autoOwn) break;
      const team = teams.get(club)!;
      const prospect = [...d.prospects].sort((a, b) => {
        const value = (p: Player) =>
          overall(p) +
          p.potential * 0.35 +
          (team.filter((x) => x.pos === p.pos).length < { P: 9, C: 2, IF: 6, OF: 4, DH: 1 }[p.pos]
            ? 15
            : 0);
        return value(b) - value(a) || a.id.localeCompare(b.id);
      })[0];
      if (!prospect || team.length >= 85) {
        d.picks.push({
          club,
          playerId: '',
          name: '지명 포기',
          round: Math.floor(d.cursor / d.order.length) + 1,
        });
        d.cursor++;
        continue;
      }
      pick(g, club, prospect);
      if (!team.some((p) => p.id === prospect.id)) team.push(prospect);
    }
    if (d.cursor >= d.order.length * rounds) {
      d.status = 'finished';
      d.round = rounds;
      postNews(
        g,
        '신인 선발 완료',
        '지명 선수는 3년 신인 계약으로 입단했습니다. 2군 육성과 1군 등록을 검토해 주세요.',
        'transfer',
        { actionView: 'draft' },
      );
    }
  }
  function action(g: GameState, a: Record<string, unknown>) {
    if (!['startDraft', 'draftPick', 'draftPass', 'draftDelegate'].includes(String(a.type)))
      return null;
    if (g.liveMatch || isUnemployed(g))
      throw new Error('소속 구단에서 경기 종료 후 진행해 주세요.');
    prepareWorld(g);
    if (a.type === 'startDraft') {
      const league = view.getClub(g.club).league,
        window = draftWindow(g, league, world);
      if (!window.open) throw new Error(`신인 드래프트 기간은 ${window.label}입니다.`);
      const team = (g.simulation!.clubs[g.club] ??= { balance: g.budget, strategy: 'develop' });
      if (team.draftYear === g.year) throw new Error('이번 시즌 신인 선발을 이미 진행했습니다.');
      const mode = ['kbo', 'npb', 'mlb', 'cpbl'].includes(league) ? 'draft' : 'academy';
      const previous =
        g.seasonStandings?.[`${g.year - 1}:${league}`] ||
        (world.draftRules?.[league]?.previousYear === g.year - 1
          ? world.draftRules[league].previousOrder
          : undefined);
      const clubIds = world.clubs.filter((c) => c.league === league).map((c) => c.id);
      const ranked = previous?.filter((id) => clubIds.includes(id));
      const order =
        mode === 'academy'
          ? [g.club]
          : ranked?.length === clubIds.length
            ? [...ranked].reverse()
            : clubIds.toSorted(
                (a, b) => hash(`${a}:${g.year}:draft`) - hash(`${b}:${g.year}:draft`),
              );
      const rounds = mode === 'academy' ? 3 : window.rounds;
      const prospects = Array.from(
        { length: Math.max(10, order.length * (rounds + 1)) },
        (_, i) => {
          const p = makePlayer(g.club, 2200 + i, undefined, g.year);
          p.id = `draft-${league}-${g.club}-${g.year}-${i}`;
          p.club = 'draft';
          p.age = 18 + (hash(p.id) % 5);
          p.salary = Math.max(1, Math.round(teamBudget(league) * 0.0004));
          p.years = 3;
          return p;
        },
      );
      g.draft = {
        year: g.year,
        league,
        mode,
        status: 'open',
        round: 1,
        rounds,
        orderYear: ranked?.length === clubIds.length ? g.year - 1 : undefined,
        orderSource:
          ranked?.length === clubIds.length
            ? '직전 시즌 최종 순위 역순'
            : '과거 순위 자료 없음 · 게임 추첨',
        order,
        cursor: 0,
        prospects,
        picks: [],
      };
      team.draftYear = g.year;
      for (const id of order) {
        const other = (g.simulation!.clubs[id] ??= {
          balance: teamBudget(league),
          strategy: 'develop',
        });
        other.draftYear = g.year;
      }
      postNews(
        g,
        '신인 드래프트 · 지명 차례 안내',
        `${gameDate(g)} · 후보를 스카우트에게 관찰시키거나 지금 지명할 수 있습니다.`,
        'scout',
        { actionView: 'draft' },
      );
      progress(g);
      return g;
    }
    const d = g.draft;
    if (
      !d ||
      d.year !== g.year ||
      d.status !== 'open' ||
      d.order[d.cursor % d.order.length] !== g.club
    )
      throw new Error('현재 우리 구단의 지명 차례가 아닙니다.');
    if (a.type === 'draftPick') {
      const p = d.prospects.find((p) => p.id === a.id);
      if (!p) throw new Error('지명 가능한 신인을 선택해 주세요.');
      pick(g, g.club, p);
    } else if (a.type === 'draftPass') {
      d.picks.push({
        club: g.club,
        playerId: '',
        name: '지명 포기',
        round: Math.floor(d.cursor / d.order.length) + 1,
      });
      d.cursor++;
    }
    progress(g, a.type === 'draftDelegate');
    return g;
  }
  function tick(g: GameState) {
    if (isUnemployed(g)) return;
    const league = view.getClub(g.club).league,
      key = `${g.year}:${league}`,
      window = draftWindow(g, league, world);
    if (window.open && g.draftNotice !== key && g.simulation?.clubs[g.club]?.draftYear !== g.year) {
      g.draftNotice = key;
      postNews(
        g,
        '신인 드래프트 기간 시작',
        `${window.label}. 직전 시즌 순위에 따른 지명 순서를 확인하고 신인 선수를 선택하세요.`,
        'scout',
        { actionView: 'draft' },
      );
    }
  }
  return { action, progress, tick };
}
