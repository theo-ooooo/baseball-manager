'use client';
import type { GameState } from '@dugout/shared/types';
import {
  matchCommandOptions,
  isPitchingCommand,
  nextMatchHalf,
} from '@dugout/shared/match-commands';
import type { Act } from '../career/game-contracts';

const descriptions = {
  stealSecond: '타자의 타순을 유지하고 2루를 노립니다.',
  stealThird: '2루 주자를 3루로 보냅니다. 실패 위험이 더 높습니다.',
  bunt: '아웃 하나를 감수하고 주자를 한 베이스 전진시킵니다.',
  hitAndRun: '주자가 먼저 출발합니다. 장타보다 컨택에 집중합니다.',
  attackBatter: '볼넷을 줄이고 스트라이크로 승부합니다. 장타에 주의하세요.',
  pitchAround: '유인구로 헛스윙을 노립니다. 볼넷과 체력 소모가 늘어납니다.',
  induceGrounder: '낮은 공으로 장타를 억제합니다. 1루 주자가 있으면 병살을 노립니다.',
  intentionalWalk: '이 타자를 1루로 보냅니다. 만루에서는 밀어내기 실점합니다.',
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
  const defending = nextMatchHalf(live, cursor) !== (live.home === g.club ? 1 : 0);
  return (
    <section className="match-command-panel" id="match-command-panel" aria-label="타석 작전 지시">
      <header>
        <strong>{defending ? '마운드에 보내는 사인' : '벤치의 승부수'}</strong>
        <span>다음 플레이 한 번에 적용됩니다.</span>
      </header>
      <div className="match-command-cards">
        {matchCommandOptions(live, g.club, cursor)
          .filter((option) => isPitchingCommand(option.kind) === defending)
          .map((option) => (
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
      <p>
        {defending
          ? '한 타자에게만 적용한 뒤 기본 투구 방침으로 돌아갑니다. 고의4구 외의 결과는 확정되지 않습니다.'
          : '주자의 스피드·체력, 타자의 컨택, 상대 투수·수비에 따라 실패할 수 있습니다.'}
      </p>
    </section>
  );
}
