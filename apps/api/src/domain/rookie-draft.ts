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
    while (d.cursor < d.order.length * 3) {
      const club = d.order[d.cursor % d.order.length];
      if (club === g.club && !autoOwn) break;
      const team = view.rosterFor(g, club);
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
    }
    if (d.cursor >= d.order.length * 3) {
      d.status = 'finished';
      d.round = 3;
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
      if (!['preseason', 'finished'].includes(g.phase))
        throw new Error('신인 선발은 프리시즌 또는 시즌 종료 후 진행합니다.');
      const league = view.getClub(g.club).league;
      const team = (g.simulation!.clubs[g.club] ??= { balance: g.budget, strategy: 'develop' });
      if (team.draftYear === g.year) throw new Error('이번 시즌 신인 선발을 이미 진행했습니다.');
      const mode = ['kbo', 'npb', 'mlb', 'cpbl'].includes(league) ? 'draft' : 'academy';
      let order =
        mode === 'academy'
          ? [g.club]
          : view
              .standings(g, league)
              .map((s) => s.club)
              .reverse();
      // Explicitly simplified game rules, not league-rule parity.
      if (['npb', 'mlb'].includes(league))
        order = order.toSorted(
          (a, b) => hash(`${a}:${g.year}:draft`) - hash(`${b}:${g.year}:draft`),
        );
      const prospects = Array.from({ length: Math.max(10, order.length * 4) }, (_, i) => {
        const p = makePlayer(g.club, 2200 + i, undefined, g.year);
        p.id = `draft-${league}-${g.club}-${g.year}-${i}`;
        p.club = 'draft';
        p.age = 18 + (hash(p.id) % 5);
        p.salary = Math.max(1, Math.round(teamBudget(league) * 0.0004));
        p.years = 3;
        return p;
      });
      g.draft = {
        year: g.year,
        league,
        mode,
        status: 'open',
        round: 1,
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
        '신인 선발 명단 도착',
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
  return { action, progress };
}
