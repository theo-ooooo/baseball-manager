'use client';
import type { GameState } from '@dugout/shared/types';
import { matchCommandOptions } from '@dugout/shared/match-commands';
import type { Act } from '../career/game-contracts';

const descriptions = {
  stealSecond: '타자의 타순을 유지하고 2루를 노립니다.',
  stealThird: '2루 주자를 3루로 보냅니다. 실패 위험이 더 높습니다.',
  bunt: '아웃 하나를 감수하고 주자를 한 베이스 전진시킵니다.',
  hitAndRun: '주자가 먼저 출발합니다. 장타보다 컨택에 집중합니다.',
};
export function MatchCommandPanel({
  g,
  cursor,
  busy,
  act,
}: {
  g: GameState;
  cursor: number;
  busy: boolean;
  act: Act;
}) {
  const live = g.liveMatch!;
  return (
    <section className="match-command-panel" id="match-command-panel" aria-label="타석 작전 지시">
      <header>
        <strong>벤치의 승부수</strong>
        <span>다음 플레이 한 번에 적용됩니다.</span>
      </header>
      <div className="match-command-cards">
        {matchCommandOptions(live, g.club, cursor).map((option) => (
          <button
            key={option.kind}
            disabled={busy || !!option.reason}
            onClick={() =>
              void act({
                type: 'matchCommand',
                command: option.kind,
                cursor,
                timelineVersion: live.timelineVersion,
              })
            }
          >
            <strong>{option.label}</strong>
            <span>{option.reason || descriptions[option.kind]}</span>
          </button>
        ))}
      </div>
      <p>주자의 스피드·컨디션, 타자의 컨택, 상대 투수·수비에 따라 실패할 수 있습니다.</p>
    </section>
  );
}
