import {
  managerAbilityKeys,
  managerAbilityLabels,
  managerAbilityEffects,
  managerAbilityNote,
  type ManagerAbility,
} from '@dugout/shared/manager-ability';
export function ManagerProfileAbilities({
  ability,
  self,
}: {
  ability: ManagerAbility;
  self: boolean;
}) {
  return (
    <section className="dossier-card manager-skill-sheet">
      <header>
        <h2>지도 능력과 효과</h2>
        <span>경기 · 훈련 · 선수단</span>
      </header>
      <p className="manager-background-summary">{managerAbilityNote(ability)}</p>
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
          현재 평판에 따라 능력이 변합니다. 직접 하는 선수단 대화는 감독 능력, 코치에게 맡긴 대화는
          담당 코치의 지도력을 따릅니다.
        </p>
      )}
    </section>
  );
}
