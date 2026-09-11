import type { GameState } from '@dugout/shared/types';
import { cardCatalog, cardGrades } from '@dugout/shared/tactic-cards';
import { useTacticCards } from './use-tactic-cards';
import type { Act } from './game-contracts';
export function TacticCardsPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const h = useTacticCards(g),
    s = g.tacticCards;
  return (
    <section className="tactic-card-room">
      <header>
        <small>상대 선수 방해 카드</small>
        <h2>내 손에 들어온 5장의 변수</h2>
        <p>
          시작 카드 5장 중 원하는 카드를 골라 상대 선수에게 사용하세요. 그 구단과의 다음 공식 경기
          한 번에 적용됩니다.
        </p>
      </header>
      {!s?.initialDrawn ? (
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void act({ type: 'drawInitialCards' })}
        >
          시작 카드 5장 뽑기
        </button>
      ) : (
        <>
          <div className="card-grade-guide">
            {Object.entries(cardGrades).map(([key, grade]) => (
              <span key={key} className={`card-grade ${key}`}>
                {grade.label} · 능력 −{grade.strength}
              </span>
            ))}
          </div>
          {s.armed && (
            <div className="armed-card">
              <strong>
                {cardGrades[s.armed.card.grade].label} · {cardCatalog[s.armed.card.kind].name}
              </strong>
              <p>
                {h.getClub(s.armed.opponent).name} · {s.armed.name} 대상. 해당 구단과 경기 전까지
                회수할 수 있습니다. 대상이 출전하지 않아도 경기 후 소모됩니다.
              </p>
              <button
                className="button secondary"
                disabled={busy || !!g.liveMatch}
                onClick={() => void act({ type: 'returnTacticCard' })}
              >
                카드 회수
              </button>
            </div>
          )}
          <div className="tactic-card-hand">
            {s.hand.map((c) => (
              <button
                key={c.id}
                className={`tactic-card ${c.grade}`}
                aria-pressed={h.selected === c.id}
                onClick={() => {
                  h.setSelected(c.id);
                  h.setTarget('');
                }}
              >
                <small>{cardGrades[c.grade].label}</small>
                <span aria-hidden="true">
                  {c.kind === 'control' ? '◎' : c.kind === 'power' ? '✦' : '◈'}
                </span>
                <strong>{cardCatalog[c.kind].name}</strong>
                <p>
                  상대 {cardCatalog[c.kind].target}의 {cardCatalog[c.kind].label}{' '}
                  <b>−{cardGrades[c.grade].strength}</b>
                </p>
                <small>공식 경기 1회</small>
              </button>
            ))}
          </div>
          {!s.hand.length && <p>손에 남은 카드가 없습니다.</p>}
          {h.card && !s.armed && (
            <form
              className="card-target-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act({ type: 'armTacticCard', id: h.card!.id, target: h.target }))
                  h.setSelected('');
              }}
            >
              <h3>{cardCatalog[h.card.kind].name} · 대상 선택</h3>
              <label>
                상대 구단
                <select
                  value={h.club}
                  onChange={(e) => {
                    h.setClub(e.target.value);
                    h.setTarget('');
                  }}
                >
                  {h.others.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                상대 선수
                <select required value={h.target} onChange={(e) => h.setTarget(e.target.value)}>
                  <option value="">선수를 선택하세요</option>
                  {h.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.pos}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary" disabled={busy || !!g.liveMatch || !h.target}>
                다음 맞대결에 이 카드 사용
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
