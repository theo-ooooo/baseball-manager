import {
  managerAbilityKeys,
  managerAbilityLabels,
  managerAbilityEffects,
  managerAbilityNote,
  type ManagerAbility,
} from '@dugout/shared/manager-ability';
import type { ManagerJourney } from '@dugout/shared/manager-journey';
import { managerExperienceBonus, managerExperienceReasons } from '@dugout/shared/manager-journey';
import { managerPlayingTrait } from '@dugout/shared/manager-traits';
import type { ManagerBackground } from '@dugout/shared/manager-background';
export function ManagerProfileAbilities({
  ability,
  self,
  journey,
  background,
}: {
  ability: ManagerAbility;
  self: boolean;
  journey?: ManagerJourney;
  background?: ManagerBackground;
}) {
  const trait = managerPlayingTrait(background);
  return (
    <section className="dossier-card manager-skill-sheet">
      <header>
        <h2>지도 능력과 효과</h2>
        <span>경기 · 훈련 · 선수단</span>
      </header>
      <p className="manager-background-summary">{managerAbilityNote(ability)}</p>
      {trait && (
        <div className="manager-playing-trait">
          <strong>{trait.name}</strong>
          <p>{trait.detail}</p>
          <span>
            {Object.entries(trait.bonus)
              .map(
                ([key, value]) => `${managerAbilityLabels[key as keyof ManagerAbility]} +${value}`,
              )
              .join(' · ')}
          </span>
          <small>선수 경력에 따른 게임 특성 · 아래 능력에 포함</small>
        </div>
      )}
      <div className="manager-skill-rows">
        {managerAbilityKeys.map((key) => (
          <div key={key}>
            <div className="manager-skill-title">
              <h3>{managerAbilityLabels[key]}</h3>
              <strong>
                {ability[key]}
                <small> / 100</small>
              </strong>
            </div>
            <progress max={100} value={ability[key]} aria-label={managerAbilityLabels[key]} />
            <p>{managerAbilityEffects[key]}</p>
            {journey && (
              <div className="manager-experience">
                <span>
                  시작 {journey.baseAbility[key]} · 경험 성장 +
                  {managerExperienceBonus(journey.experience[key])}
                </span>
                <small>
                  {journey.experience[key] >= 1200 || ability[key] >= 95
                    ? '성장 상한 도달'
                    : `다음 성장 ${journey.experience[key] % 100} / 100 XP`}
                </small>
                <progress
                  max={100}
                  value={journey.experience[key] >= 1200 ? 100 : journey.experience[key] % 100}
                  aria-label={`${managerAbilityLabels[key]} 경험`}
                />
                <p>{managerExperienceReasons[key]}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="person-profile-note">
        선수의 기량과 컨디션, 지시한 전술에 지도 능력이 더해집니다. 양쪽 감독에게 같은 기준을
        적용하며 코치에게 경기를 맡겨도 감독의 효과는 유지됩니다. 진행 중이던 경기는 기존 방식으로
        마칩니다.
      </p>
      {self && (
        <p className="person-profile-note">
          평판과 별개로 지도 경험을 쌓아 능력이 성장합니다. 100 XP마다 해당 능력 +1, 경험 성장은
          항목별 최대 +12입니다. 직접 하는 대화는 감독 능력, 맡긴 대화는 담당 코치의 지도력을
          따릅니다.
        </p>
      )}
    </section>
  );
}
