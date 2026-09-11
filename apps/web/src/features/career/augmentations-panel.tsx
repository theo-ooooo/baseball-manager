import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import { augmentationCatalog } from '@dugout/shared/augmentations';
import { matchCardGrades } from '@dugout/shared/match-cards';
import { MatchCardsSummary } from '../matches/match-cards-panel';
import type { Act } from './game-contracts';
export function AugmentationsPanel({ g }: { g: GameState; act: Act; busy: boolean }) {
  return (
    <section className="augmentation-room">
      <header>
        <small>매 경기 새로 준비하는 증강과 카드</small>
        <h2>5장 중 3장, 오늘의 승부수</h2>
        <p>
          경기장에 입장하면 양 팀에 무작위 증강이 주어지고 카드 5장을 받습니다. 원하는 3장을
          확정하면 해당 경기 동안 적용됩니다.
        </p>
      </header>
      <Link className="button primary" href="/match">
        경기 준비로 이동
      </Link>
      {g.liveMatch?.cards?.selected && <MatchCardsSummary draft={g.liveMatch.cards} />}
      <div className="augmentation-choices">
        {Object.entries(augmentationCatalog).map(([kind, a]) => (
          <article key={kind} className={'augmentation-card ' + a.tone}>
            <span aria-hidden="true">{a.icon}</span>
            <small>매 경기 무작위 지급</small>
            <h3>{a.name}</h3>
            <p>{a.description}</p>
          </article>
        ))}
      </div>
      <div className="card-grade-guide">
        {Object.entries(matchCardGrades).map(([grade, value]) => (
          <span key={grade} className={'card-grade ' + grade}>
            {value.label} · 능력 {value.percent}%
          </span>
        ))}
      </div>
      <p>
        타선 봉쇄는 상대 타자 전체의 컨택과 파워를 등급에 따라 5·10·15·20% 낮춥니다. 증강 무효화는
        상대의 무작위 증강을 경기 끝까지 막고, 선택한 카드의 효과는 유지합니다.
      </p>
      <p>
        시범경기에도 적용되며 다음 경기에는 다시 지급됩니다. 코치에게 경기 전체를 맡기면 카드 선택도
        위임합니다. 이미 진행 중이던 이전 버전 경기는 원래 규칙을 유지합니다.
      </p>
    </section>
  );
}
