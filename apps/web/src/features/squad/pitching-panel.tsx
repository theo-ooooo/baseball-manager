'use client';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { GameState, Player } from '@dugout/shared/types';
import { firstTeam } from '@dugout/shared/management';
import { pitchingAssignment, pitchingRole } from '@dugout/shared/pitching';
import { ratingText } from '@dugout/shared/ratings';

/** Read-only role derivation lives in shared; the server owns every change through `pitchingRole`. */
export { pitchingAssignment };
export type PitchingAssignment = ReturnType<typeof pitchingAssignment>;
type Role = Exclude<PitchingAssignment, ''>;
type Selectable = Exclude<Role, 'reserve'>;

export const roleNames: Record<Role, string> = {
  starter: '선발',
  closer: '마무리',
  setup: '필승조',
  chase: '추격조',
  bullpen: '일반 불펜',
  reserve: '2군',
};
export const roleHelp: Record<Role, string> = {
  starter: '지정한 순서와 회복 상태에 따라 등판합니다.',
  closer: '9회 이후 1~3점 리드에서 우선 기용합니다.',
  setup: '6회 이후 동점이거나 1~3점 리드일 때 우선 기용합니다.',
  chase: '뒤지고 있는 경기에서 우선 기용합니다.',
  bullpen: '이른 교체나 넉넉한 리드에서 우선 기용합니다.',
  reserve: '2군 소속이라 1군 경기에 등판하지 않습니다.',
};
export const REPLACEMENT_NOTE =
  '체력이 충분한 미등판 투수를 우선 기용하고, 모두 지쳤으면 남은 불펜을 기용합니다.';
/** Order used by every selector and group list. */
export const selectableRoles: Selectable[] = ['starter', 'setup', 'chase', 'bullpen', 'closer'];
export const LOW_CONDITION = 65;

/** Short label such as '선발 2', '필승조', '2군'. Empty for non-pitchers. */
export const assignmentLabel = pitchingRole;

export function RoleBadge({ role, children }: { role: PitchingAssignment; children?: string }) {
  if (!role) return null;
  return <span className={`ui-role ui-role-${role}`}>{children || roleNames[role]}</span>;
}

export function RoleSelect({
  g,
  p,
  busy,
  act,
  className = '',
}: {
  g: GameState;
  p: Player;
  busy: boolean;
  act: (a: Record<string, unknown>) => Promise<GameState | null>;
  className?: string;
}) {
  const role = pitchingAssignment(g, p);
  if (!role || role === 'reserve') return null;
  return (
    <select
      className={`ui-role-select ${className}`}
      aria-label={`${p.name} 보직`}
      disabled={busy}
      value={role}
      onChange={(e) => void act({ type: 'pitchingRole', id: p.id, role: e.target.value })}
    >
      {selectableRoles.map((value) => (
        <option key={value} value={value}>
          {roleNames[value]}
        </option>
      ))}
    </select>
  );
}

type Props = {
  g: GameState;
  busy: boolean;
  act: (a: Record<string, unknown>) => Promise<GameState | null>;
  onPlayer: (p: Player) => void;
};
export function PitchingPanel({ g, busy, act, onPlayer }: Props) {
  const plan = g.pitching;
  if (!plan) return null;
  const pitchers = firstTeam(g).filter((p) => p.pos === 'P'),
    byId = new Map(pitchers.map((p) => [p.id, p])),
    reserves = g.roster.filter((p) => p.pos === 'P' && p.squad === 'reserve');
  // Keep the saved order inside each group so the list never jumps after a change.
  const ordered = [
    ...plan.rotation,
    plan.closer,
    ...plan.bullpen,
    ...pitchers.map((p) => p.id),
  ].filter((id, i, all) => id && byId.has(id) && all.indexOf(id) === i);
  const groups: { role: Selectable; players: Player[] }[] = selectableRoles.map((role) => ({
    role,
    players: ordered.map((id) => byId.get(id)!).filter((p) => pitchingAssignment(g, p) === role),
  }));
  const move = (at: number, delta: number) => {
    const ids = [...plan.rotation],
      to = at + delta;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    void act({ type: 'rotationOrder', ids });
  };
  return (
    <section className="panel training-block pitching-panel ui-scope">
      <div className="panel-header">
        <h2>투수 운용</h2>
        <span>
          1군 투수 {pitchers.length}명 · 선발 {plan.rotation.length} · 불펜{' '}
          {pitchers.length - plan.rotation.length - (plan.closer ? 1 : 0)} · 마무리{' '}
          {plan.closer ? 1 : 0}
        </span>
      </div>
      <div className="ui-pitching">
        {groups.map(({ role, players }) => (
          <section className="ui-pitching-group" key={role} aria-labelledby={`ui-pg-${role}`}>
            <header>
              <h3 id={`ui-pg-${role}`}>
                <RoleBadge role={role}>
                  {role === 'starter' ? '선발 로테이션' : roleNames[role]}
                </RoleBadge>
                <span className="ui-pitching-count">{players.length}명</span>
              </h3>
              <p>{roleHelp[role]}</p>
            </header>
            {players.length ? (
              <ul>
                {players.map((p) => {
                  const at = plan.rotation.indexOf(p.id),
                    tired = p.condition < LOW_CONDITION;
                  return (
                    <li className="ui-pitcher" key={p.id}>
                      <button className="ui-pitcher-name" onClick={() => onPlayer(p)}>
                        <strong>
                          {role === 'starter' && <em>{at + 1}</em>}
                          {p.name}
                        </strong>
                        <small>
                          능력 {ratingText(p)} ·{' '}
                          <span className={tired ? 'ui-warn' : ''}>
                            체력 {Math.round(p.condition)}%{tired ? ' · 부족' : ''}
                          </span>
                          {g.starter === p.id && <b className="ui-next-tag">다음 경기 선발</b>}
                        </small>
                      </button>
                      <div className="ui-pitcher-controls">
                        <button
                          className="button secondary compact"
                          disabled={busy || g.starter === p.id}
                          onClick={() => void act({ type: 'starter', id: p.id })}
                        >
                          {g.starter === p.id ? '다음 선발' : '다음 경기 선발로 지정'}
                        </button>
                        {role === 'starter' && (
                          <>
                            <button
                              className="ui-order"
                              disabled={busy || at <= 0}
                              aria-label={`${p.name} 로테이션 순서 올리기`}
                              onClick={() => move(at, -1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              className="ui-order"
                              disabled={busy || at >= plan.rotation.length - 1}
                              aria-label={`${p.name} 로테이션 순서 내리기`}
                              onClick={() => move(at, 1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </>
                        )}
                        <RoleSelect g={g} p={p} busy={busy} act={act} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ui-pitching-empty">
                {role === 'closer' || role === 'starter'
                  ? '지정된 투수가 없습니다.'
                  : '지정된 투수가 없으면 일반 불펜이 대신합니다.'}
              </p>
            )}
          </section>
        ))}
      </div>
      <footer className="ui-pitching-foot">
        <p>{REPLACEMENT_NOTE} 처음 보직은 확인된 이닝·등판·세이브 기록을 참고한 게임 추천입니다.</p>
        {reserves.length > 0 && (
          <p>
            2군 투수 {reserves.length}명은 1군 등록 후 보직을 지정할 수 있습니다:{' '}
            {reserves.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <button className="ui-link" onClick={() => onPlayer(p)}>
                  {p.name}
                </button>
              </span>
            ))}
          </p>
        )}
      </footer>
    </section>
  );
}
