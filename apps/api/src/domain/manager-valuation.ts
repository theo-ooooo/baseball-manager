import type { GameState } from '@dugout/shared/types';
import type { ClubManagerJob, ManagerOffer } from '@dugout/shared/manager-career';

export function managerPerformance(
  g: Pick<GameState, 'managerCareer' | 'managerJobs' | 'club' | 'standings'>,
) {
  const contract = g.managerCareer?.contract;
  if (!contract || g.managerCareer?.status !== 'employed') return 0;
  const table =
    Object.values(g.standings).find((rows) => rows.some((r) => r.club === g.club)) || [];
  const sorted = [...table].sort(
    (a, b) =>
      b.w / Math.max(1, b.w + b.l) - a.w / Math.max(1, a.w + a.l) ||
      b.w - a.w ||
      b.rf - b.ra - (a.rf - a.ra) ||
      a.club.localeCompare(b.club),
  );
  const row = table.find((r) => r.club === g.club),
    rank = sorted.findIndex((r) => r.club === g.club) + 1;
  const games = row ? row.w + row.l + row.d : 0;
  if (games < 5 || !row) return 0;
  const rankScore =
    rank === 1
      ? 1
      : rank <= Math.ceil(table.length * 0.3)
        ? 0.7
        : rank <= contract.targetRank
          ? 0.4
          : 0.1;
  const over = Math.max(
    -0.2,
    Math.min(0.2, (contract.targetRank - rank) / Math.max(1, table.length)),
  );
  return Math.max(0, Math.min(1, (rankScore + over) * Math.min(1, games / 20)));
}

export function clubNegotiationBudget(
  g: GameState,
  club: string,
  baseSalary: number,
  annualBudget: number,
): NonNullable<ManagerOffer['negotiationBudget']> {
  const cash =
    club === g.club
      ? g.budget
      : (g.clubCareers?.[club]?.budget ?? g.simulation?.clubs[club]?.balance ?? annualBudget);
  const room = Math.max(0.5, Math.min(1.2, cash / Math.max(1, annualBudget)));
  const salary = Math.round(baseSalary * (1.25 + room * 0.2) * 100) / 100;
  const signingBonus =
    Math.round(Math.min(Math.max(0, cash) * 0.02, salary * (0.2 + room * 0.15)) * 100) / 100;
  const years = room >= 0.8 ? 3 : 2;
  return {
    salary,
    signingBonus,
    years,
    total: Math.round((salary * years + signingBonus) * 100) / 100,
  };
}

export function approachValuation(
  g: GameState,
  baseSalary: number,
  budget: NonNullable<ManagerOffer['negotiationBudget']>,
) {
  const currentSalary =
    g.managerCareer?.status === 'employed' ? g.managerCareer.contract?.salary || 0 : 0;
  const performance = managerPerformance(g);
  const reputation = Math.max(0, Math.min(1, ((g.managerCareer?.reputation || 50) - 50) / 40));
  const premium = 0.1 + performance * 0.3 + reputation * 0.1;
  const salary =
    Math.round(
      Math.min(
        budget.salary,
        Math.max(baseSalary * (1 + performance * 0.15), currentSalary * (1 + premium)),
      ) * 100,
    ) / 100;
  return {
    salary,
    signingBonus: Math.min(
      budget.signingBonus,
      Math.round(salary * (0.08 + performance * 0.12) * 100) / 100,
    ),
    valuation: {
      currentSalary,
      increasePercent: currentSalary ? Math.round((salary / currentSalary - 1) * 100) : 0,
      performance,
      reason:
        performance >= 0.7
          ? '상위권 성과와 감독 평판을 반영한 영입 제안'
          : performance >= 0.35
            ? '시즌 목표권 성과와 이직 조건을 반영한 제안'
            : '감독 경력과 현재 계약을 고려한 영입 제안',
    },
  };
}

/** One credit update per newly completed game; finance penalties stay reversible. */
export function updateBoardTrust(
  job: ClubManagerJob,
  options: {
    year: number;
    rank: number;
    target: number;
    count: number;
    wins: number;
    losses: number;
    draws: number;
    financePenalty: number;
  },
) {
  const { year, rank, target, count, wins, losses, draws, financePenalty } = options;
  const games = wins + losses + draws;
  if (!job.board || job.board.year !== year || job.board.appointed !== job.appointed)
    job.board = {
      year,
      appointed: job.appointed,
      games: 0,
      rank,
      leaderGames: 0,
      topGames: 0,
      credit: 0,
      previousConfidence: job.confidence,
      change: 0,
    };
  const board = job.board,
    delta = Math.max(0, games - board.games);
  if (delta > 0) {
    // Missing historical observations must not invent a whole season at the current rank.
    const observed = Math.min(delta, 1);
    board.leaderGames = rank === 1 ? board.leaderGames + observed : 0;
    board.topGames = rank <= Math.ceil(count * 0.3) ? board.topGames + observed : 0;
    const credit =
      games < 5 ? 0 : rank === 1 ? 0.85 : rank < target ? 0.25 : rank <= target ? 0.08 : -0.35;
    board.credit = Math.max(-12, Math.min(20, board.credit + credit * observed));
    board.previousConfidence = job.confidence;
  }
  const position =
    games >= 5 ? Math.max(-24, Math.min(18, (target - rank) * 3)) * Math.min(1, games / 20) : 0;
  job.confidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        job.baseConfidence + wins * 1.5 - losses * 1.5 + position + board.credit - financePenalty,
      ),
    ),
  );
  if (delta > 0) board.change = job.confidence - board.previousConfidence;
  board.games = games;
  board.rank = rank;
  job.reason =
    games < 5
      ? '시즌 초반 성적을 지켜보는 중'
      : rank === 1
        ? `리그 선두 · 선두 유지 ${board.leaderGames}경기 · 감독의 우승 경쟁력을 신뢰`
        : rank < target
          ? `현재 ${rank}위 · 목표 ${target}위보다 앞선 성과를 평가`
          : rank === target
            ? `현재 ${rank}위 · 목표권에 진입했으며 꾸준한 유지가 필요`
            : `현재 ${rank}위 · 목표 ${target}위까지 ${rank - target}계단 개선 필요`;
}
