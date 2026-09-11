import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import {
  internationalCalendar,
  internationalDutyFor,
  internationalCountries as countries,
  nationalCountry,
  type InternationalTournament,
  type InternationalEvent,
} from '@dugout/shared/international';
import { createGameView, overall } from '@dugout/shared/game-view';
import { isAvailable } from '@dugout/shared/long-term';
import { gameDate } from '@dugout/shared/calendar';
import { isUnemployed } from '@dugout/shared/manager-career';
import { postNews } from './club-dynamics';
import { repairMedicalSelection } from './medical';
import { changeSquad } from './roster-moves';
import { nationalReplacement } from '@dugout/shared/international-replacement';

/** Game selection, not the historical national roster: ratings, positions and availability. */
export function selectInternationalPlayers(players: Player[], event: InternationalTournament) {
  const pool = players.filter((p) => isAvailable(p) && !p.injury && p.club !== 'fa');
  let nations = event.kind === 'asian' ? ['대한민국', '대만', '중국'] : countries;
  if (event.kind === 'olympic' || event.kind === 'premier') {
    const strengths = new Map(
      countries.map((country) => [
        country,
        pool
          .filter((p) => nationalCountry(p) === country)
          .sort((a, b) => overall(b) - overall(a))
          .slice(0, 24)
          .reduce((n, p) => n + overall(p), 0),
      ]),
    );
    const ranked = [...countries].sort(
      (a, b) => (strengths.get(b) || 0) - (strengths.get(a) || 0) || a.localeCompare(b),
    );
    if (event.kind === 'premier') nations = ranked.slice(0, 16);
    else {
      // Six game qualifiers, using national strength for the still-undecided slots.
      const asia = ranked.find((c) => ['대한민국', '일본', '대만'].includes(c))!;
      const other = ranked.find((c) =>
        ['네덜란드', '이탈리아', '영국', '체코', '호주'].includes(c),
      )!;
      nations = ['미국', '베네수엘라', '도미니카공화국', asia, other];
      nations.push(ranked.find((c) => !nations.includes(c))!);
    }
  }
  const selected: string[] = [],
    chosen = new Set<string>(),
    clubCounts = new Map<string, number>();
  const remaining = new Map<string, number>();
  for (const p of pool) {
    const key = `${p.club}:${p.pos}`;
    remaining.set(key, (remaining.get(key) || 0) + 1);
  }
  for (const country of nations) {
    let wildcards = 0;
    const koreanAsian = event.kind === 'asian' && country === '대한민국';
    const eligible = pool
      .filter(
        (p) =>
          nationalCountry(p) === country &&
          (!koreanAsian || (p.club.startsWith('kbo-') && p.age <= 29)) &&
          (!(event.kind === 'premier') || !p.club.startsWith('mlb-')),
      )
      .sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id));
    const quotas: [Player['pos'], number][] = [
      ['P', event.kind === 'wbc' ? 14 : 11],
      ['C', 2],
      ['IF', event.kind === 'wbc' ? 8 : 7],
      ['OF', event.kind === 'wbc' ? 6 : 4],
    ];
    const nationClubs = new Set<string>();
    for (const [pos, quota] of quotas) {
      for (let i = 0; i < quota; i++) {
        const available = (p: Player) =>
          (p.pos === pos || (pos === 'OF' && p.pos === 'DH')) &&
          !chosen.has(
            p.nationalTeam?.identity ||
              (p.portrait ? `${p.portrait.league}:${p.portrait.officialId}` : p.id),
          ) &&
          (clubCounts.get(p.club) || 0) < 3 &&
          (!koreanAsian || p.age <= 25 || wildcards < 3) &&
          (remaining.get(`${p.club}:${p.pos}`) || 0) >
            (p.pos === 'DH' ? 0 : pos === 'P' ? 3 : pos === 'C' ? 1 : 3);
        const p =
          (koreanAsian
            ? eligible.find((p) => !nationClubs.has(p.club) && available(p))
            : undefined) || eligible.find(available);
        if (!p) break;
        selected.push(p.id);
        chosen.add(
          p.nationalTeam?.identity ||
            (p.portrait ? `${p.portrait.league}:${p.portrait.officialId}` : p.id),
        );
        nationClubs.add(p.club);
        clubCounts.set(p.club, (clubCounts.get(p.club) || 0) + 1);
        remaining.set(`${p.club}:${p.pos}`, remaining.get(`${p.club}:${p.pos}`)! - 1);
        if (koreanAsian && p.age > 25) wildcards++;
      }
    }
  }
  return selected;
}

export function createInternational(world: WorldCatalog) {
  const view = createGameView(world);
  const identities = new Map(world.players.filter((p) => p.nationalTeam).map((p) => [p.id, p]));
  function sync(g: GameState) {
    for (const p of [...g.roster, ...g.transferred]) {
      const identity = identities.get(p.id);
      if (identity) {
        p.country = identity.country;
        p.nationalTeam = identity.nationalTeam;
      } else if (!p.real && p.country === '미국 · 캐나다')
        p.country = p.id.startsWith('mlb-bluejays-') ? '캐나다' : '미국';
      const duty = internationalDutyFor(g, p.id);
      if (duty) p.internationalDuty = duty;
      else delete p.internationalDuty;
    }
  }
  function report(g: GameState, e: InternationalEvent) {
    const own = g.roster.filter((p) => e.players.includes(p.id));
    const returning = e.stage === 'returned',
      away = e.stage === 'away';
    postNews(
      g,
      `${e.name} · ${returning ? '대표팀 복귀' : away ? '대표팀 합류' : '차출 명단 발표'}${!isUnemployed(g) && own.length ? ` (${own.length}명)` : ''}`,
      returning
        ? '대표팀 일정이 끝났습니다. 복귀 선수의 컨디션과 현재 1군 등록 상태를 확인해 주세요. 기존 등록·재등록 대기 규정은 유지됩니다.'
        : `${e.start}~${e.end} 대회에 참가합니다. ${e.departure}부터 구단 경기에 출전할 수 없으며 ${e.returnDate} 복귀 예정입니다. ${away ? '수석 코치가 남아 있는 1군 선수로 명단을 정비했습니다.' : '합류일까지 구단 경기에 출전할 수 있습니다.'}`,
      'league',
      {
        internationalEventId: e.id,
        actionView: 'squad',
        sender: { name: '국가대표 운영팀', role: '국제대회 차출 안내' },
        report: {
          facts: [
            { label: '대회 기간', value: `${e.start} ~ ${e.end}` },
            { label: '구단 복귀', value: e.returnDate },
            { label: '명단', value: '게임 내 능력·포지션·국적 기준 선발' },
          ],
          players: isUnemployed(g)
            ? []
            : own.map((p) => ({
                id: p.id,
                name: p.name,
                detail: `${nationalCountry(p)} 대표 · ${returning ? `컨디션 ${Math.round(p.condition)}%` : `${e.returnDate} 복귀 예정`}`,
              })),
          sections: [
            {
              title: '운영 기준',
              body: '소집 3일 전 합류·대회 종료 이틀 뒤 복귀는 게임 기준입니다. 대체 등록도 일반 말소·재등록 규정을 따르며 복귀 즉시 자동으로 1군에 올리지는 않습니다.',
            },
          ],
        },
      },
    );
  }
  function tick(g: GameState) {
    if (g.liveMatch) return;
    sync(g);
    const today = gameDate(g);
    let events = g.international?.events || [],
      changed = false;
    // Expired seasons are pruned; no past tournament is re-simulated on migration/season jumps.
    events = events.filter((e) => e.returnDate.slice(0, 4) >= String(g.year - 1));
    for (const old of events)
      if (old.stage !== 'returned' && today >= old.returnDate) {
        const returned: InternationalEvent = { ...old, stage: 'returned' };
        events = events.map((e) => (e.id === old.id ? returned : e));
        changed = true;
        g.international = { events };
        sync(g);
        for (const p of g.roster)
          if (old.players.includes(p.id))
            p.condition = Math.max(0, p.condition - (p.pos === 'P' ? 12 : 8));
        report(g, returned);
      }
    for (const tournament of internationalCalendar(g.year)) {
      let event = events.find((e) => e.id === tournament.id);
      if (!event && today >= tournament.announce && today < tournament.returnDate) {
        const players = view.clubs.flatMap((c) => view.rosterFor(g, c.id));
        event = {
          ...tournament,
          players: selectInternationalPlayers(players, tournament),
          stage: 'selected',
        };
        events = [...events, event];
        changed = true;
        report(g, event);
      }
      if (!event) continue;
      const stage =
        today >= event.returnDate ? 'returned' : today >= event.departure ? 'away' : 'selected';
      if (stage !== event.stage) {
        event = { ...event, stage };
        events = events.map((e) => (e.id === event!.id ? event! : e));
        changed = true;
        // Publish updated immutable state before deriving availability.
        g.international = { events };
        sync(g);
        if (stage === 'returned')
          for (const p of g.roster)
            if (event.players.includes(p.id))
              p.condition = Math.max(0, p.condition - (p.pos === 'P' ? 12 : 8));
        report(g, event);
      }
    }
    if (changed || events.length !== g.international?.events.length) g.international = { events };
    sync(g);
    if (changed) repairMedicalSelection(g);
  }
  function action(g: GameState, a: Record<string, unknown>) {
    if (a.type !== 'internationalReplacement') return null;
    const outgoing = g.roster.find((p) => p.id === a.id);
    if (!outgoing?.internationalDuty) throw new Error('현재 대표팀에 차출된 선수를 확인해 주세요.');
    const incoming = nationalReplacement(g, outgoing.id);
    if (!incoming || incoming.id !== a.replacementId)
      throw new Error('대체 선수의 등록·복귀 상태가 변경됐습니다. 현재 추천을 확인해 주세요.');
    changeSquad(g, { id: incoming.id, value: 'first', replaceId: outgoing.id }, 'coach');
    repairMedicalSelection(g);
    return g;
  }
  return { tick, sync, action };
}
