'use client';
import type { GameState } from '@dugout/shared/types';
import { matchCommandLabels, isPitchingCommand } from '@dugout/shared/match-commands';
import type { Act } from '../career/game-contracts';
import { useMatchCommand } from './use-match-command';

const descriptions = {
  contactFocus: '장타 욕심을 줄이고 인플레이 타구에 집중합니다. 삼진 위험이 줄어듭니다.',
  swingAway: '강한 타구와 장타를 노립니다. 헛스윙과 삼진 위험이 늘어납니다.',
  workCount: '공을 더 지켜보며 볼넷을 노립니다. 루킹 삼진 위험도 있습니다.',
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
  const m = useMatchCommand(g, cursor, busy, act);
  const { defending } = m;
  return (
    <section className="match-command-panel" id="match-command-panel" aria-label="타석 작전 지시">
      <header>
        <strong>{defending ? '마운드에 보내는 사인' : '타자에게 보내는 작전'}</strong>
        <span>다음 플레이 한 번에 적용됩니다.</span>
      </header>
      {m.previous && (
        <div className="match-repeat-command">
          <span>
            이전 사인: <b>{m.previous.label}</b>
          </span>
          <button
            disabled={busy || !!m.previous.reason}
            onClick={() => m.setSelected(m.previous!.kind)}
          >
            다시 선택
          </button>
          {m.previous.reason && <small>{m.previous.reason}</small>}
        </div>
      )}
      <div className="match-command-cards">
        {m.options
          .filter((option) => isPitchingCommand(option.kind) === defending)
          .map((option) => (
            <button
              key={option.kind}
              disabled={busy || !!option.reason}
              aria-pressed={m.selected === option.kind}
              onClick={() => m.setSelected(option.kind)}
            >
              <strong>{option.label}</strong>
              <span>{option.reason || descriptions[option.kind]}</span>
            </button>
          ))}
      </div>
      <div className="match-command-confirm">
        <span>
          {m.selected
            ? `선택한 사인: ${matchCommandLabels[m.selected]}`
            : '사인을 골라 검토하세요.'}
        </span>
        <button
          className="button primary"
          disabled={busy || !m.selected || m.selected === m.queued}
          onClick={() => void m.confirm()}
        >
          {m.selected === m.queued && m.queued ? '현재 대기 중인 사인' : '사인 확정 · 경기 재개'}
        </button>
      </div>
      <p>
        {defending
          ? '한 타자에게만 적용한 뒤 기본 투구 방침으로 돌아갑니다. 고의4구 외의 결과는 확정되지 않습니다.'
          : '주자의 스피드·체력, 타자의 컨택, 상대 투수·수비에 따라 실패할 수 있습니다.'}
      </p>
    </section>
  );
}
