import type { GameState, Player, Pos, WorldCatalog } from '@dugout/shared/types';
import type { ScoutAssignment, ScoutReport } from '@dugout/shared/scouting';
import { signingOutlook } from '@dugout/shared/signing-outlook';
import { scoutingCost, scoutingDurations } from '@dugout/shared/scouting';
import { addDays, gameDate } from '@dugout/shared/calendar';
import { abilityKeys, abilityLabels } from '@dugout/shared/development';
import { askPrice, createGameView, hash, money, overall } from '@dugout/shared/game-view';
import { postNews } from './club-dynamics';

export function prepareKnowledge(g: GameState, world: WorldCatalog) {
  const league = world.clubs.find((c) => c.id === g.club)!.league;
  g.knowledge = g.knowledge ? { ...g.knowledge } : { leagues: [league], clubs: [] };
  g.knowledge.players = [
    ...new Set([...(g.knowledge.players || []), ...g.roster.map((p) => p.id)]),
  ];
  g.knowledge.clubs = world.clubs
    .filter((c) => g.knowledge!.leagues.includes(c.league))
    .map((c) => c.id);
}

/** 보고서 본문. 기존 강점·우려에 영입 전망을 덧붙인다. */
function signingLines(g: GameState, r: ScoutReport) {
  const lines = [...r.strengths, ...r.concerns];
  if (!r.signing) return lines;
  const { label, demand, fee, affordable, reason } = r.signing;
  lines.push(
    `${label} · 기대 연봉 ${money(demand[0])}~${money(demand[1])}${
      fee ? ` · 예상 이적료 ${money(fee)}` : ' · 이적료 없음'
    }`,
    reason,
    affordable
      ? `현재 예산 ${money(g.budget)} 으로 감당할 수 있는 범위입니다.`
      : `현재 예산 ${money(g.budget)} 으로는 부족합니다.`,
  );
  return lines;
}
export function createScouting(world: WorldCatalog) {
  const view = createGameView(world);
  const state = (g: GameState) => (g.scouting ??= { shortlist: [], assignments: [], reports: [] });
  function action(g: GameState, a: Record<string, unknown>): GameState | null {
    if (!['shortlistPlayer', 'assignScout', 'cancelScout'].includes(String(a.type))) return null;
    const s = state(g);
    if (a.type === 'cancelScout') {
      const task = s.assignments.find((t) => t.id === a.id);
      if (!task || task.status !== 'active')
        throw new Error('진행 중인 관찰 임무를 선택해 주세요.');
      task.status = 'cancelled';
      delete task.candidateIds;
      return g;
    }
    const market = [...view.marketPlayers(g), ...(g.draft?.prospects || [])];
    if (a.type === 'shortlistPlayer') {
      if (typeof a.add !== 'boolean') throw new Error('관심 명단 등록 여부를 선택해 주세요.');
      const id = String(a.id);
      if (!a.add) {
        s.shortlist = s.shortlist.filter((p) => p !== id);
        return g;
      }
      if (!market.some((p) => p.id === id)) throw new Error('관찰할 외부 선수를 찾을 수 없습니다.');
      if (s.shortlist.includes(id)) return g;
      if (s.shortlist.length >= 100) throw new Error('관심 명단은 최대 100명입니다.');
      s.shortlist.push(id);
      return g;
    }
    const days = Number(a.days);
    if (!scoutingDurations.some((d) => d === days))
      throw new Error('관찰 기간은 7일, 14일, 28일 중 선택해 주세요.');
    const scout = g.staff.find((c) => c.role === '스카우트' && c.id === a.scoutId);
    if (!scout) throw new Error('관찰을 담당할 스카우트를 선택해 주세요.');
    if (s.assignments.filter((t) => t.status === 'active').length >= 3)
      throw new Error('동시에 세 개의 관찰 임무를 진행할 수 있습니다.');
    let target: ScoutAssignment['target'], label: string, candidates: Player[];
    if (a.playerId) {
      const p = market.find((p) => p.id === a.playerId);
      if (!p) throw new Error('관찰할 외부 선수를 찾을 수 없습니다.');
      target = { playerId: p.id };
      label = `${p.name} 개인 관찰`;
      candidates = [p];
    } else {
      const league = world.leagues.find((l) => l.id === a.league);
      const maxAge = Number(a.maxAge),
        pos = String(a.pos);
      if (
        !league ||
        !['all', 'P', 'C', 'IF', 'OF', 'DH'].includes(pos) ||
        !Number.isInteger(maxAge) ||
        maxAge < 16 ||
        maxAge > 50
      )
        throw new Error('리그·포지션·최대 나이를 확인해 주세요.');
      target = { league: league.id, pos: pos as Pos | 'all', maxAge };
      label = `${league.name} · ${maxAge}세 이하 ${pos === 'all' ? '전체 포지션' : pos}`;
      candidates = market.filter(
        (p) =>
          view.getClub(p.club)?.league === league.id &&
          p.age <= maxAge &&
          (pos === 'all' || p.pos === pos),
      );
      // At most three discoveries per mission; no per-day catalog scan or simulation.
      candidates.sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id));
      candidates = candidates.slice(0, 3);
      if (!candidates.length)
        throw new Error('조건에 맞는 선수가 없습니다. 관찰 범위를 넓혀 주세요.');
    }
    if (
      s.assignments.some(
        (t) => t.status === 'active' && JSON.stringify(t.target) === JSON.stringify(target),
      )
    )
      throw new Error('같은 대상의 관찰이 이미 진행 중입니다.');
    const cost = scoutingCost(days, 'league' in target);
    if (g.budget < cost) throw new Error('스카우트 파견 예산이 부족합니다.');
    const started = gameDate(g);
    const task: ScoutAssignment = {
      id: `scout-${started}-${hash(JSON.stringify(target))}-${s.assignments.length}-${g.expenses}`,
      target,
      label,
      scoutId: scout.id,
      scoutName: scout.name,
      started,
      due: addDays(started, days),
      days,
      cost,
      status: 'active',
      candidateIds: candidates.map((p) => p.id),
    };
    s.assignments = [task, ...s.assignments].slice(0, 30);
    g.budget -= cost;
    g.expenses += cost;
    postNews(
      g,
      `${label} · 관찰 시작`,
      `${scout.name} 스카우트가 ${days}일간 관찰합니다. ${task.due} 보고 예정 · 파견비 ${money(cost)}. 취소 시 파견비는 반환되지 않습니다.`,
      'scout',
      {
        actionView: 'scouting',
        scoutAssignmentId: task.id,
        id: `scout:${task.id}:started`,
        sender: { name: scout.name, role: '스카우트' },
      },
    );
    return g;
  }
  function report(g: GameState, p: Player, task: ScoutAssignment): ScoutReport {
    const skill = g.staff.find((c) => c.id === task.scoutId)?.skill ?? 35;
    const confidence = Math.min(95, Math.round(35 + task.days * 1.2 + skill * 0.25));
    const width = Math.max(2, Math.round((100 - confidence) / 7));
    const range = (value: number, key: string): [number, number] => {
      const bias = (hash(`${p.id}:${task.started}:${key}`) % (width + 1)) - Math.floor(width / 2);
      return [
        Math.max(20, Math.floor(value + bias - width)),
        Math.min(99, Math.ceil(value + bias + width)),
      ];
    };
    const keys = abilityKeys.filter((k) =>
      p.pos === 'P'
        ? ['stuff', 'control', 'field', 'speed'].includes(k)
        : !['stuff', 'control'].includes(k),
    );
    const ranked = [...keys].sort((a, b) => p[b] - p[a]);
    const peers = g.roster.filter((x) => x.pos === p.pos);
    const baseline = peers.reduce((s, p) => s + overall(p), 0) / Math.max(1, peers.length);
    return {
      playerId: p.id,
      playerName: p.name,
      date: gameDate(g),
      scoutName: task.scoutName,
      confidence,
      overall: range(overall(p), 'overall'),
      abilities: Object.fromEntries(keys.map((k) => [k, range(p[k], k)])),
      verdict:
        overall(p) >= baseline + 3
          ? '즉시 전력 검토'
          : p.age <= 23
            ? '육성 후보 검토'
            : '추가 관찰 권장',
      strengths: ranked.slice(0, 2).map((k) => `${abilityLabels[k]}이 상대적 강점입니다.`),
      concerns: [
        `${abilityLabels[ranked.at(-1)!]}을 기존 선수와 비교해 주세요.`,
        p.years > 1 && p.club !== 'fa'
          ? `잔여 계약 ${p.years}년으로 구단 이적 협의가 필요합니다.`
          : '개인 계약 조건과 실제 영입 가능 여부는 협상에서 확인해야 합니다.',
      ],
      salary: p.salary,
      fee: askPrice(p),
      signing: signingOutlook(g, p, askPrice(p), confidence),
    };
  }
  function tick(g: GameState) {
    const s = g.scouting;
    const due = s?.assignments.filter((t) => t.status === 'active' && t.due <= gameDate(g));
    if (!s || !due?.length) return;
    const market = new Map(
      [...view.marketPlayers(g), ...(g.draft?.prospects || [])].map((p) => [p.id, p]),
    );
    for (const task of due) {
      const reports = (task.candidateIds || []).slice(0, 3).flatMap((id) => {
        const p = market.get(id);
        return p ? [report(g, p, task)] : [];
      });
      task.status = 'completed';
      task.reportIds = reports.map((r) => r.playerId);
      delete task.candidateIds;
      const ids = new Set(task.reportIds);
      s.reports = [...reports, ...s.reports.filter((r) => !ids.has(r.playerId))].slice(0, 100);
      postNews(
        g,
        `${task.label} · 관찰 보고 도착`,
        reports.length
          ? `${reports.length}명의 관찰을 마쳤습니다. 관심 명단에 추가하고 기존 선수와 비교한 뒤 영입을 결정하세요.`
          : '관찰 대상의 소속이 바뀌어 외부 영입 보고를 작성하지 못했습니다.',
        'scout',
        {
          actionView: 'scouting',
          scoutAssignmentId: task.id,
          id: `scout:${task.id}:completed`,
          sender: { name: task.scoutName, role: '스카우트' },
          report: {
            facts: [
              { label: '관찰 기간', value: `${task.days}일` },
              { label: '파견 비용', value: money(task.cost) },
            ],
            players: reports.map((r) => ({
              id: r.playerId,
              name: r.playerName,
              detail: `${r.verdict} · 관찰 OVR ${r.overall.join('–')} · 신뢰도 ${r.confidence}%${r.signing ? ` · ${r.signing.label}` : ''}`,
            })),
            sections: reports.map((r) => ({
              title: r.playerName,
              body: signingLines(g, r).join('\n'),
            })),
          },
        },
      );
    }
  }
  return { action, tick };
}
