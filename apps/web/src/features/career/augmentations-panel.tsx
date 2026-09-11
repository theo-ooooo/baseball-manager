import { TacticCardsPanel } from './tactic-cards-panel';
import type { GameState } from '@dugout/shared/types';
import { augmentationCatalog, type AugmentationKind } from '@dugout/shared/augmentations';
import type { Act } from './game-contracts';
export function AugmentationsPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const s = g.augmentations,
    active = s?.club === g.club ? s.active : undefined;
  return (
    <>
      <TacticCardsPanel g={g} act={act} busy={busy} />
      <section className="augmentation-room">
        <header>
          <small>우리 선수 강화 · 증강</small>
          <h2>우리 팀에 더할 특별한 힘</h2>
          <p>
            증강은 경기 확률을 바꾸는 판타지 옵션입니다. 시작 보상 1회, 이후 공식 경기 8경기마다
            선택권을 얻습니다.
          </p>
        </header>
        {!s?.enabled ? (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void act({ type: 'enableAugmentations' })}
          >
            증강 시작 · 첫 선택권 받기
          </button>
        ) : (
          <>
            <div className="augmentation-status">
              <strong>선택권 {s.credits}개</strong>
              <span>
                {active
                  ? `${augmentationCatalog[active.kind].name} · 공식 경기 ${active.remaining}회 남음`
                  : '장착한 증강 없음'}{' '}
                · 중복 장착 불가
              </span>
            </div>
            <div className="augmentation-choices">
              {(
                Object.entries(augmentationCatalog) as [
                  AugmentationKind,
                  (typeof augmentationCatalog)[AugmentationKind],
                ][]
              ).map(([kind, a]) => (
                <article key={kind} className={`augmentation-card ${a.tone}`}>
                  <span aria-hidden="true">{a.icon}</span>
                  <small>공식 경기 5회</small>
                  <h3>{a.name}</h3>
                  <p>{a.description}</p>
                  <button
                    className="button primary"
                    disabled={busy || !s.credits || !!active || s.club !== g.club}
                    onClick={() => void act({ type: 'chooseAugmentation', kind })}
                  >
                    {active?.kind === kind ? '현재 적용 중' : '이 증강 선택'}
                  </button>
                </article>
              ))}
            </div>
            <p className="augmentation-note">
              확률은 게임의 상·하한 안에서 적용됩니다. 홈런 확률은 안타가 나온 경우를 기준으로 하며,
              승리나 특정 결과를 보장하지 않습니다.
            </p>
          </>
        )}
      </section>
    </>
  );
}
