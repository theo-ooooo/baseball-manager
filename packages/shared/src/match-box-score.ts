import type { Result } from './types';
import { playKind } from './replay';
export function matchBoxScore(result: Result) {
  const teams = [0, 1].map((side) => ({
    club: side ? result.home : result.away,
    batters: new Map<
      string,
      {
        id: string;
        ab: number;
        h: number;
        hr: number;
        rbi: number;
        bb: number;
        k: number;
        sb: number;
      }
    >(),
    pitchers: new Map<
      string,
      { id: string; outs: number; h: number; r: number; bb: number; k: number }
    >(),
  }));
  for (const row of result.log) {
    const play = row.play;
    if (!play) continue;
    const batting = teams[row.half],
      fielding = teams[1 - row.half];
    if (!batting || !fielding) continue;
    const pitcher = fielding.pitchers.get(play.pitcher) || {
      id: play.pitcher,
      outs: 0,
      h: 0,
      r: 0,
      bb: 0,
      k: 0,
    };
    fielding.pitchers.set(play.pitcher, pitcher);
    pitcher.outs += Math.max(0, play.after.outs - play.before.outs);
    const runs = Math.max(
      0,
      (play.after.score[row.half] ?? 0) - (play.before.score[row.half] ?? 0),
    );
    pitcher.r += runs;
    if (play.steal?.safe) {
      const runner = batting.batters.get(play.steal.runner) || {
        id: play.steal.runner,
        ab: 0,
        h: 0,
        hr: 0,
        rbi: 0,
        bb: 0,
        k: 0,
        sb: 0,
      };
      runner.sb++;
      batting.batters.set(runner.id, runner);
    }
    if (play.plateAppearance === false) continue;
    const batter = batting.batters.get(play.batter) || {
      id: play.batter,
      ab: 0,
      h: 0,
      hr: 0,
      rbi: 0,
      bb: 0,
      k: 0,
      sb: 0,
    };
    batting.batters.set(batter.id, batter);
    const kind = playKind(row.text),
      hit = ['single', 'double', 'triple', 'homeRun'].includes(kind);
    // Follow this game's scoring, including the existing sacrifice-RBI at-bat convention.
    const sacrificeBunt = play.command === 'bunt' && row.text.includes('희생');
    if (kind !== 'walk' && !sacrificeBunt) batter.ab++;
    if (hit) {
      batter.h++;
      pitcher.h++;
    }
    if (kind === 'homeRun') batter.hr++;
    if (kind === 'walk') {
      batter.bb++;
      pitcher.bb++;
    }
    if (kind === 'strikeout') {
      batter.k++;
      pitcher.k++;
    }
    batter.rbi += runs;
  }
  return teams.map((team, side) => {
    const names = new Map(result.replayTeams?.[side]?.players.map((p) => [p.id, p.name]) || []);
    return {
      ...team,
      batters: [...team.batters.values()].map((p) => ({
        ...p,
        name: names.get(p.id) || '이름 미보관',
      })),
      pitchers: [...team.pitchers.values()].map((p) => ({
        ...p,
        name: names.get(p.id) || '이름 미보관',
      })),
    };
  });
}
