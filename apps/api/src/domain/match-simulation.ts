import { isAvailable } from '@dugout/shared/long-term';
import type {
  WorldCatalog,
  GameState,
  Player,
  Stats,
  Result,
  ReplayPlay,
  ReplayTeam,
} from '@dugout/shared/types';
import { autoPitching } from '@dugout/shared/pitching';
import {
  blankStats,
  overall,
  coachSkill,
  lineupAuto,
  createGameView,
} from '@dugout/shared/game-view';
import {
  firstTeam,
  defenseFor,
  autoDefense,
  defenseStrength,
  defaults,
  defensivePositions,
  familiarity,
} from '@dugout/shared/management';
import { gameDate } from '@dugout/shared/calendar';
import { pitchingDecisions } from './pitching-decisions';
import { selectReliever } from './relief-selection';
import { buntResult, stealChance } from './match-command-probabilities';
import { isPitchingCommand } from '@dugout/shared/match-commands';
import { createMatchEnergy, fatigueFactor } from './match-energy';
import { pitchingModifiers } from './pitching-tactics';

export function createMatchSimulator(world: WorldCatalog) {
  const { getClub, rosterFor } = createGameView(world);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  function* simulateMatch(
    g: GameState,
    home: string,
    away: string,
    random: () => number,
    post = false,
  ): Generator<Result, Result> {
    const involved = home === g.club || away === g.club;
    const rosters = [
      away === g.club
        ? firstTeam(g).filter(isAvailable)
        : g.liveMatch?.opponents?.[0] || rosterFor(g, away),
      home === g.club
        ? firstTeam(g).filter(isAvailable)
        : g.liveMatch?.opponents?.[1] || rosterFor(g, home),
    ];
    const lineups = rosters.map((r, i) => {
      const club = i ? home : away;
      const ids = club === g.club ? g.lineup : lineupAuto(r);
      return ids.map((id) => r.find((p) => p.id === id)!).filter(Boolean);
    });
    const energyEnabled = !g.liveMatch || g.liveMatch.energyVersion === 1;
    const pitchers = rosters.map((r, i) => {
      const id = i ? home : away;
      const rotation = autoPitching(r).rotation;
      return id === g.club
        ? r.find((p) => p.id === g.starter)!
        : r.find(
            (p) =>
              p.id === rotation[((g.day % rotation.length) + rotation.length) % rotation.length],
          )!;
    });
    const energy = createMatchEnergy(
      rosters,
      energyEnabled,
      pitchers.map((p) => p.id),
    );
    const score = [0, 0],
      hits = [0, 0],
      errors = [0, 0],
      innings: (number | null)[][] = [[], []],
      log: Result['log'] = [];
    const order = [0, 0];
    const battingParticipants = lineups.map((lineup) => new Set(lineup));
    const performance = new Map<string, number>();
    const replayTeams = rosters.map((roster, side) => {
      const lineup = lineups[side].map((p) => p.id),
        starter = pitchers[side].id;
      const defense =
        (side ? home : away) === g.club
          ? defenseFor(g)
          : autoDefense({ ...g, roster, lineup, starter, defense: undefined });
      return {
        lineup,
        defense,
        players: [...lineups[side], ...roster.filter((p) => p.pos === 'P')].map((p) => ({
          id: p.id,
          name: p.name,
          number: p.number,
          ...(energyEnabled ? { condition: p.condition } : {}),
        })),
      };
    }) as [ReplayTeam, ReplayTeam];
    const plans = rosters.map((roster, side) =>
      (side ? home : away) === g.club ? g.pitching! : autoPitching(roster),
    );
    const used = rosters.map(() => new Map<string, Stats>());
    const entered = [1, 1];
    const entries = rosters.map(() => new Map<string, { lead: number; kept: boolean }>());
    const pitcherOfRecord = [pitchers[0].id, pitchers[1].id];
    const pitchingStats = (side: number) => {
      const id = pitchers[side].id;
      if (!used[side].has(id)) {
        used[side].set(id, blankStats());
        entries[side].set(id, { lead: score[side] - score[1 - side], kept: true });
      }
      return used[side].get(id)!;
    };
    pitchingStats(0);
    pitchingStats(1);
    let changeIndex = 0;
    let commandIndex = 0;
    const commands = g.liveMatch?.commands || [];
    let manualPitcherCursor = -1;
    const applyChanges = (inning: number, bases?: (Player | null)[]) => {
      let changed = false;
      const changes = g.liveMatch?.changes || [];
      while (changeIndex < changes.length && changes[changeIndex].cursor === log.length) {
        const change = changes[changeIndex++],
          side = home === g.club ? 1 : 0;
        if (bases && (side ? home : away) === g.club) {
          for (let base = 0; base < bases.length; base++) {
            const slot = lineups[side].findIndex((p) => p.id === bases[base]?.id);
            if (slot >= 0) bases[base] = g.roster.find((p) => p.id === change.lineup[slot])!;
          }
        }
        lineups[side] = change.lineup.map((id) => g.roster.find((p) => p.id === id)!);
        for (const p of lineups[side]) {
          battingParticipants[side].add(p);
          if (!replayTeams[side].players.some((v) => v.id === p.id))
            replayTeams[side].players.push({
              id: p.id,
              name: p.name,
              number: p.number,
              ...(energyEnabled ? { condition: p.condition } : {}),
            });
        }
        g.lineup = [...change.lineup];
        g.defense = { ...change.defense };
        g.instructions = { ...change.instructions };
        if (pitchers[side].id !== change.pitcher) {
          pitchers[side] = g.roster.find((p) => p.id === change.pitcher)!;
          if (change.coldEntry && g.liveMatch?.bullpenVersion) energy.spend(pitchers[side], 12);
          entered[side] = inning;
          pitchingStats(side);
          manualPitcherCursor = log.length;
        }
        changed = true;
      }
      return changed;
    };
    const snapshot = (): Result => ({
      id: `${g.year}-${g.day}-${home}-${away}`,
      day: g.day,
      date: gameDate(g),
      home,
      away,
      homeScore: score[1],
      awayScore: score[0],
      innings,
      hits,
      errors,
      log,
      replayTeams: involved ? replayTeams : undefined,
      mvp: '',
      post,
    });
    yield snapshot();
    for (let inn = 1; inn <= 30; inn++) {
      for (let side = 0; side < 2; side++) {
        if (inn >= 9 && side === 1 && score[1] > score[0]) {
          innings[1].push(null);
          break;
        }
        applyChanges(inn);
        const defending = 1 - side,
          plan = plans[defending],
          current = pitchers[defending],
          currentStats = pitchingStats(defending),
          isStarter = current.id === replayTeams[defending].defense.P;
        const lead = score[defending] - score[side],
          closing = inn >= 9 && lead > 0 && lead <= 3;
        const target =
          15 +
          Math.min(
            6,
            Math.max(
              0,
              Math.round(
                (current.rating?.record?.outs || 0) /
                  3 /
                  Math.max(1, current.rating?.record?.g || 1) -
                  3,
              ) * 2,
            ),
          );
        if (
          !(manualPitcherCursor === log.length && (defending ? home : away) === g.club) &&
          ((isStarter && (currentStats.outs >= target || (currentStats.er >= 5 && inn >= 3))) ||
            (!isStarter && (inn - entered[defending] >= 1 || currentStats.outs >= 6)) ||
            (closing && current.id !== plan.closer) ||
            (energyEnabled && currentStats.outs > 0 && energy.get(current) < 40))
        ) {
          const available = selectReliever({
            plan,
            roster: rosters[defending],
            used: new Set(used[defending].keys()),
            inning: inn,
            lead,
            legacy: !!g.liveMatch && g.liveMatch.pitchingVersion !== 2,
          });
          if (available) {
            pitchers[defending] = available;
            entered[defending] = inn;
            pitchingStats(defending);
          }
        }
        const before = score[side];
        let outs = 0;
        const bases: (Player | null)[] = [null, null, null];
        if (inn > 9 && getClub(home).league === 'mlb')
          bases[1] = lineups[side][(order[side] + 8) % 9];
        let appearances = 0;
        const ownBat = (side ? home : away) === g.club;
        const ownPitch = (side ? away : home) === g.club;
        const context = () => {
          const pitcher = pitchers[1 - side];
          const pStrength =
            overall(pitcher) * (0.75 + pitcher.condition / 400) +
            ((pitcher.mood?.value ?? 65) - 65) * 0.08 +
            (ownPitch ? (coachSkill(g, '투수') - 50) / 6 : 0);
          const defense =
            (ownPitch
              ? defenseStrength(g)
              : rosters[1 - side].filter((p) => p.pos !== 'P').reduce((s, p) => s + p.field, 0) /
                Math.max(1, rosters[1 - side].filter((p) => p.pos !== 'P').length)) +
            (ownPitch ? (coachSkill(g, '수비') - 50) / 5 : 0);
          return { pitcher, pStrength, defense };
        };
        let { pitcher, pStrength, defense } = context();
        while (outs < 3 && appearances++ < 120) {
          if (applyChanges(inn, ownBat ? bases : undefined))
            ({ pitcher, pStrength, defense } = context());
          const command =
            commands[commandIndex]?.cursor === log.length ? commands[commandIndex++] : undefined;
          if (command && (isPitchingCommand(command.kind) ? !ownPitch : !ownBat))
            throw new Error('작전 시점의 공격·수비 팀이 일치하지 않습니다.');
          const pitcherFactor = fatigueFactor(pitcher.condition, energy.get(pitcher));
          const strength = pStrength * pitcherFactor;
          const control = pitcher.control * pitcherFactor;
          const approach =
            command?.kind === 'attackBatter'
              ? 'attack'
              : command?.kind === 'pitchAround'
                ? 'corners'
                : command?.kind === 'induceGrounder'
                  ? 'groundball'
                  : ownPitch
                    ? g.instructions?.pitching || 'balanced'
                    : 'balanced';
          const pitching = pitchingModifiers(approach, control);
          const baseRunners = bases.filter((p): p is Player => !!p);
          if (command?.kind === 'stealSecond' || command?.kind === 'stealThird') {
            const from = command.kind === 'stealSecond' ? 0 : 1;
            const runner = bases[from];
            if (!runner || bases[from + 1])
              throw new Error('도루를 시도할 주자 상황이 바뀌었습니다.');
            const catcherId = replayTeams[1 - side].defense.C;
            const catcher = rosters[1 - side].find((p) => p.id === catcherId);
            const safe =
              random() <
              stealChance(
                {
                  ...runner,
                  speed: runner.speed * fatigueFactor(runner.condition, energy.get(runner)),
                },
                { ...pitcher, control },
                catcher?.field || 50,
                from === 1,
              );
            const play: ReplayPlay = {
              batter: lineups[side][order[side] % lineups[side].length].id,
              pitcher: pitcher.id,
              before: { outs, bases: bases.map((p) => p?.id || null), score: [...score] },
              after: { outs, bases: [], score: [...score] },
              plateAppearance: false,
              command: command.kind,
              defense: { ...replayTeams[1 - side].defense, P: pitcher.id },
              steal: { runner: runner.id, safe, to: (from + 2) as 2 | 3 },
            };
            bases[from] = null;
            if (safe) {
              bases[from + 1] = runner;
              runner.stats.sb = (runner.stats.sb || 0) + 1;
            } else {
              outs++;
              pitchingStats(1 - side).outs++;
              runner.stats.cs = (runner.stats.cs || 0) + 1;
            }
            play.after = { outs, bases: bases.map((p) => p?.id || null), score: [...score] };
            energy.record(
              play,
              pitcher,
              lineups[side][order[side] % lineups[side].length],
              baseRunners,
              approach,
              '도루',
            );
            log.push({
              inning: inn,
              half: side,
              play,
              text: `${runner.name} ${from + 2}루 도루 ${safe ? '성공' : '실패'} · 감독 지시`,
              score: [...score],
            });
            yield snapshot();
            continue;
          }
          const p = lineups[side][order[side]++ % lineups[side].length];
          const play: ReplayPlay = {
            batter: p.id,
            pitcher: pitcher.id,
            before: { outs, bases: bases.map((p) => p?.id || null), score: [...score] },
            after: { outs: 0, bases: [], score: [] },
          };
          if (changeIndex)
            play.defense = { ...(ownPitch ? g.defense! : replayTeams[1 - side].defense) };
          if (command) play.command = command.kind;
          if (approach !== 'balanced') play.pitching = approach;
          const hitAndRun = command?.kind === 'hitAndRun';
          const stats = ownBat ? p.stats : blankStats();
          let runs = 0;
          let event = '';
          let isOut = false;
          const batterFactor = fatigueFactor(p.condition, energy.get(p));
          const cond = (0.7 + p.condition * 0.003) * batterFactor;
          const bonus = ownBat ? (coachSkill(g, '타격') - 50) * 0.0008 : 0;
          const instructions = g.instructions || defaults(g.tactic);
          const cohesion = ownBat ? ((g.tacticFamiliarity ?? 70) - 70) * 0.0003 : 0;
          const contact = clamp(
            0.24 +
              ((p.mood?.value ?? 65) - 65) * 0.0005 +
              cohesion +
              (p.contact * cond - strength) * 0.0028 +
              bonus +
              pitching.contact +
              (hitAndRun
                ? 0.02
                : command?.kind === 'contactFocus'
                  ? 0.025
                  : command?.kind === 'swingAway'
                    ? -0.025
                    : command?.kind === 'workCount'
                      ? -0.008
                      : 0),
            0.1,
            0.43,
          );
          const aggressive =
            command?.kind === 'contactFocus'
              ? 0
              : command?.kind === 'swingAway'
                ? 1
                : ownBat
                  ? instructions.power / 100
                  : 0;
          const patient =
            command?.kind === 'workCount' ? 1 : ownBat ? instructions.patience / 100 : 0;
          const smallball = ownBat ? instructions.steal / 100 : 0;
          const roll = command?.kind === 'intentionalWalk' ? 1 : random();
          if (command?.kind === 'bunt') {
            if (outs >= 2 || (!bases[0] && !bases[1]) || bases[2])
              throw new Error('희생번트 주자 상황이 바뀌었습니다.');
            const outcome = buntResult(
              { ...p, contact: p.contact * batterFactor, speed: p.speed * batterFactor },
              defense,
              g.tacticFamiliarity ?? 70,
              roll,
            );
            if (outcome === 'hit' || outcome === 'sacrifice') {
              bases[2] = bases[1];
              bases[1] = bases[0];
              bases[0] = outcome === 'hit' ? p : null;
              if (outcome === 'hit') {
                stats.ab++;
                stats.h++;
                hits[side]++;
                event = '번트 안타 · 감독 지시';
              } else {
                stats.sh = (stats.sh || 0) + 1;
                outs++;
                pitchingStats(1 - side).outs++;
                isOut = true;
                event = '희생번트 성공 · 감독 지시';
              }
            } else {
              stats.ab++;
              outs++;
              pitchingStats(1 - side).outs++;
              isOut = true;
              if (outcome === 'strikeout') {
                stats.k++;
                pitchingStats(1 - side).k++;
                event = '번트 실패 · 삼진';
              } else event = '번트 실패 · 뜬공 아웃';
            }
          } else if (
            command?.kind === 'intentionalWalk' ||
            roll <
              clamp(
                0.073 +
                  (70 - control) * 0.0009 +
                  patient * 0.032 +
                  pitching.walk +
                  (command?.kind === 'workCount'
                    ? 0.02
                    : command?.kind === 'contactFocus'
                      ? -0.015
                      : 0),
                energyEnabled ? 0.025 : 0.035,
                energyEnabled ? 0.2 : 0.14,
              )
          ) {
            stats.bb++;
            pitchingStats(1 - side).bb++;
            if (bases[0]) {
              if (bases[1]) {
                if (bases[2]) runs++;
                bases[2] = bases[1];
              }
              bases[1] = bases[0];
            }
            bases[0] = p;
            event = command?.kind === 'intentionalWalk' ? '고의4구 · 감독 지시' : '볼넷';
          } else if (roll < 0.08 + contact + -aggressive * 0.018 + pitching.walk) {
            stats.ab++;
            stats.h++;
            hits[side]++;
            const extra = random();
            const hrChance = clamp(
              (0.1 +
                (p.power * batterFactor - strength) * 0.003 +
                aggressive * 0.08 +
                pitching.homeRun) *
                (hitAndRun ? 0.65 : 1),
              0.03,
              0.33,
            );
            const advance =
              extra < hrChance
                ? 4
                : extra < hrChance + 0.015
                  ? 3
                  : extra < hrChance + 0.22 + (ownPitch ? (50 - instructions.depth) * 0.001 : 0)
                    ? 2
                    : 1;
            if (advance === 4) {
              runs = 1 + bases.filter(Boolean).length;
              bases.fill(null);
              stats.hr++;
              pitchingStats(1 - side).hr++;
              event = '홈런';
            } else {
              for (let b = 2; b >= 0; b--)
                if (bases[b]) {
                  let move = advance;
                  if (hitAndRun && advance === 1 && b === 0) move = 2;
                  if (advance === 1 && b === 1 && random() < bases[b]!.speed / 160) move = 2;
                  if (b + move >= 3) runs++;
                  else bases[b + move] = bases[b];
                  bases[b] = null;
                }
              bases[advance - 1] = p;
              event = advance === 1 ? '안타' : advance === 2 ? '2루타' : '3루타';
            }
          } else if (
            random() <
            clamp(
              (75 - defense) * 0.001 +
                0.012 +
                (ownPitch ? Math.abs(instructions.depth - 50) * 0.00005 : 0),
              0.004,
              0.05,
            )
          ) {
            stats.ab++;
            if (bases[2]) runs++;
            bases[2] = bases[1];
            bases[1] = bases[0];
            bases[0] = p;
            errors[1 - side]++;
            event = '수비 실책 출루';
          } else {
            stats.ab++;
            outs++;
            isOut = true;
            pitchingStats(1 - side).outs++;
            if (
              random() <
              0.36 +
                aggressive * 0.09 -
                (hitAndRun ? 0.09 : 0) +
                pitching.strikeout +
                (command?.kind === 'contactFocus'
                  ? -0.08
                  : command?.kind === 'swingAway'
                    ? 0.08
                    : command?.kind === 'workCount'
                      ? 0.03
                      : 0)
            ) {
              stats.k++;
              pitchingStats(1 - side).k++;
              event = '삼진';
            } else {
              event = '범타';
              if (
                bases[0] &&
                outs < 3 &&
                random() < (hitAndRun ? 0.05 : 0.15) + pitching.doublePlay
              ) {
                outs++;
                pitchingStats(1 - side).outs++;
                bases[0] = null;
                event = '병살타';
              } else if (bases[2] && outs < 3 && random() < 0.22) {
                runs++;
                bases[2] = null;
                event = '희생 타점';
              }
            }
          }
          if (hitAndRun) {
            event += ' · 히트앤드런';
            if (event.startsWith('삼진') && bases[0] && !bases[1] && outs < 3) {
              const runner = bases[0];
              const safe = random() < stealChance(runner, pitcher, defense);
              bases[0] = null;
              if (safe) {
                bases[1] = runner;
                runner.stats.sb = (runner.stats.sb || 0) + 1;
              } else {
                outs++;
                pitchingStats(1 - side).outs++;
                runner.stats.cs = (runner.stats.cs || 0) + 1;
              }
              play.steal = { runner: runner.id, safe };
              event += safe ? ' · 주자 2루 진루' : ' · 주자 도루 실패';
            }
          }
          if (command && isPitchingCommand(command.kind) && command.kind !== 'intentionalWalk')
            event += ` · ${command.kind === 'attackBatter' ? '정면 승부' : command.kind === 'pitchAround' ? '유인구 승부' : '낮게 승부'}`;
          if (command?.kind === 'contactFocus') event += ' · 컨택 집중';
          if (command?.kind === 'swingAway') event += ' · 장타 노림';
          if (command?.kind === 'workCount') event += ' · 공 오래 보기';
          if (
            !command &&
            smallball &&
            bases[0] &&
            !bases[1] &&
            outs < 3 &&
            random() < smallball * 0.26
          ) {
            const runnerPlayer = bases[0]!,
              runner = runnerPlayer.id;
            if (random() < clamp(bases[0]!.speed / 105, 0.3, 0.92)) {
              bases[1] = bases[0];
              bases[0] = null;
              play.steal = { runner, safe: true };
              if (ownBat) runnerPlayer.stats.sb = (runnerPlayer.stats.sb || 0) + 1;
              event += ' · 2루 도루';
            } else {
              bases[0] = null;
              outs++;
              pitchingStats(1 - side).outs++;
              play.steal = { runner, safe: false };
              if (ownBat) runnerPlayer.stats.cs = (runnerPlayer.stats.cs || 0) + 1;
              event += ' · 도루 실패';
            }
          }
          const priorLead = score[side] - score[1 - side];
          score[side] += runs;
          if (priorLead <= 0 && score[side] > score[1 - side])
            pitcherOfRecord[side] = pitchers[side].id;
          if (score[side] >= score[1 - side])
            entries[1 - side].get(pitchers[1 - side].id)!.kept = false;
          stats.rbi += runs;
          pitchingStats(1 - side).er += runs;
          performance.set(p.name, (performance.get(p.name) || 0) + (isOut ? 0 : 1) + runs * 2);
          play.after = { outs, bases: bases.map((p) => p?.id || null), score: [...score] };
          energy.record(play, pitcher, p, baseRunners, approach, event);
          if (involved)
            log.push({
              inning: inn,
              half: side,
              play,
              text: `${p.name} ${event}${runs ? ` · ${runs}타점` : ''}`,
              score: [...score],
            });
          yield snapshot();
          if (inn >= 9 && side === 1 && score[1] > score[0]) break;
        }
        innings[side].push(score[side] - before);
      }
      if (inn >= 9 && score[0] !== score[1]) break;
      if (!post && inn >= 12) break;
    }
    // Postseason games continue through a bounded sudden-death tiebreak inning.
    if (post && score[0] === score[1]) {
      const side = random() < 0.5 ? 0 : 1;
      score[side]++;
      innings[0].push(side === 0 ? 1 : 0);
      innings[1].push(side === 1 ? 1 : 0);
      log.push({
        inning: innings[0].length,
        half: side,
        text: '승부치기 결승 득점',
        score: [...score],
      });
    }
    if (involved) {
      const side = home === g.club ? 1 : 0,
        won = score[side] > score[1 - side];
      const decisions = pitchingDecisions(
        [...used[side]].map(([id, stats]) => ({
          id,
          outs: stats.outs,
          runs: stats.er,
          entryLead: entries[side].get(id)!.lead,
          keptLead: entries[side].get(id)!.kept,
        })),
        replayTeams[side].defense.P,
        pitcherOfRecord[side],
        won,
      );
      for (const [id, stats] of used[side]) {
        const p = g.roster.find((p) => p.id === id)!;
        p.stats.g++;
        for (const key of ['outs', 'er', 'k', 'bb'] as const) p.stats[key] += stats[key];
        p.stats.hrAllowed = (p.stats.hrAllowed || 0) + stats.hr;
        if (id === decisions.winner) p.stats.wins++;
        if (id === decisions.save) p.stats.saves = (p.stats.saves || 0) + 1;
        if (decisions.holds.includes(id)) p.stats.holds = (p.stats.holds || 0) + 1;
        p.condition = energyEnabled
          ? energy.get(p)
          : clamp(
              p.condition - (id === replayTeams[side].defense.P ? 48 : 12 + stats.outs * 2),
              20,
              100,
            );
      }
      for (const p of battingParticipants[side]) {
        p.stats.g++;
        p.condition = energyEnabled ? energy.get(p) : clamp(p.condition - 6, 25, 100);
      }
    }

    if (involved) {
      const d = defenseFor(g);
      for (const pos of defensivePositions) {
        const p = g.roster.find((p) => p.id === d[pos]);
        if (p) {
          p.familiarity ??= {};
          p.familiarity[pos] = Math.min(100, familiarity(p, pos) + 0.15);
        }
      }
    }
    return {
      id: `${g.year}-${g.day}-${home}-${away}`,
      day: g.day,
      date: gameDate(g),
      home,
      away,
      homeScore: score[1],
      awayScore: score[0],
      innings,
      hits,
      errors,
      log,
      replayTeams: involved ? replayTeams : undefined,
      mvp: [...performance].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      post,
    };
  }

  return simulateMatch;
}
