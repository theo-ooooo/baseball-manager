'use client';
import { ratingText, potentialText } from '../../packages/shared/src/ratings';
import { lineupReason } from '../../packages/shared/src/player-attributes';
import { PitchingPanel } from './pitching-panel';
import { useState } from 'react';
import type {
  DefensivePosition,
  GameState,
  Player,
  TeamInstructions,
} from '../../packages/shared/src/types';
import { blankStats, coachRoles, money, overall } from '../../packages/shared/src/game-view';
import {
  dayLabel,
  defaults,
  defenseFor,
  defensivePositions,
  familiarity,
  firstTeam,
  positionLabels,
  reserveTeam,
} from '../../packages/shared/src/management';
import { useWorld } from './world-context';

type Act = (action: Record<string, unknown>) => Promise<GameState | null>;
type Props = { g: GameState; act: Act; busy: boolean; onPlayer: (p: Player) => void };
const presetNames = {
  balanced: '균형',
  power: '장타 중심',
  smallball: '기동력',
  patient: '선구안',
};
const fieldPoints: { pos: DefensivePosition; x: number; y: number }[] = [
  { pos: 'LF', x: 20, y: 22 },
  { pos: 'CF', x: 50, y: 13 },
  { pos: 'RF', x: 80, y: 22 },
  { pos: '3B', x: 19, y: 58 },
  { pos: 'SS', x: 37, y: 42 },
  { pos: '2B', x: 63, y: 42 },
  { pos: '1B', x: 81, y: 58 },
  { pos: 'P', x: 50, y: 63 },
  { pos: 'C', x: 50, y: 88 },
  { pos: 'DH', x: 13, y: 87 },
];
export function DefensiveField({
  g,
  act,
  busy,
  onPlayer,
  compact = false,
}: {
  g: GameState;
  act?: Act;
  busy?: boolean;
  onPlayer: (p: Player) => void;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState('');
  const defense = defenseFor(g);
  const chosen = g.roster.find((p) => p.id === selected);
  async function place(id: string, pos: DefensivePosition) {
    if (!act || busy) return;
    if (await act({ type: 'defense', id, position: pos })) setSelected('');
  }
  return (
    <div
      className="defensive-editor"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setSelected('');
      }}
    >
      <div className={`field ${compact ? 'compact' : ''}`}>
        <div className="field-topline">
          <span>수비 배치</span>
          <span>{act ? '끌어서 이동 · 클릭으로도 배치' : '다음 경기'}</span>
        </div>
        <svg className="field-lines" viewBox="0 0 500 400" aria-hidden="true">
          <path d="M250 360 L35 145 Q250 -35 465 145 Z" fill="#1a382d" stroke="#43624f" />
          <path d="M250 360 L70 180 M250 360 L430 180" stroke="#597260" />
          <path d="M250 340 L148 238 L250 136 L352 238 Z" fill="#233c31" stroke="#749078" />
          <circle cx="250" cy="254" r="24" fill="none" stroke="#526b51" />
          <path d="M242 345h16v10l-8 6-8-6z" fill="#bdcbbb" />
        </svg>
        {fieldPoints.map(({ pos, x, y }) => {
          const p = g.roster.find((p) => p.id === defense[pos]);
          if (!p) return null;
          const fit = Math.round(familiarity(p, pos));
          return (
            <button
              key={pos}
              className={`field-player ${selected === p.id ? 'picked' : ''} ${fit < 50 ? 'unfamiliar' : ''}`}
              style={{ left: x + '%', top: y + '%' }}
              disabled={busy}
              draggable={!!act && !busy}
              aria-pressed={act ? selected === p.id : undefined}
              aria-label={`${positionLabels[pos]} ${p.name}, 숙련도 ${fit}%. ${selected ? '여기에 배치' : '선수 선택'}`}
              title={`${p.name} · ${positionLabels[pos]} 숙련도 ${fit}%`}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', p.id);
                e.dataTransfer.effectAllowed = 'move';
                setSelected(p.id);
              }}
              onDragEnd={() => setSelected('')}
              onDragOver={(e) => {
                if (act && !busy) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                void place(e.dataTransfer.getData('text/plain'), pos);
              }}
              onClick={() => {
                if (!act) onPlayer(p);
                else if (selected && selected !== p.id) void place(selected, pos);
                else setSelected(selected ? '' : p.id);
              }}
            >
              <span className={pos === 'P' ? 'pitcher' : ''}>{pos}</span>
              <strong>{p.name}</strong>
              {!compact && <small>{fit}%</small>}
            </button>
          );
        })}
      </div>
      {act && (
        <>
          <div className="placement-hint" role="status">
            {chosen
              ? `${chosen.name} 선택됨 · 배치할 위치를 누르세요.`
              : '선수를 다른 위치로 끌면 서로 자리를 바꿉니다. 벤치 선수도 끌어서 교체할 수 있습니다.'}
            {selected && (
              <button className="text-button" onClick={() => setSelected('')}>
                선택 취소
              </button>
            )}
          </div>
          <div className="bench-list">
            {firstTeam(g)
              .filter((p) => !Object.values(defense).includes(p.id))
              .map((p) => (
                <button
                  key={p.id}
                  className={selected === p.id ? 'selected' : ''}
                  disabled={busy}
                  draggable={!busy}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', p.id);
                    setSelected(p.id);
                  }}
                  onDragEnd={() => setSelected('')}
                  onClick={() => setSelected(selected === p.id ? '' : p.id)}
                >
                  <span>{p.pos}</span>
                  {p.name}
                  <small>{Math.round(p.condition)}%</small>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
export function PositionTraining({ p, act, busy }: { p: Player; act: Act; busy: boolean }) {
  const options = defensivePositions.filter((pos) => (pos === 'P') === (p.pos === 'P'));
  return (
    <label className="position-training">
      개인 포지션 훈련
      <select
        aria-label={`${p.name} 훈련 포지션`}
        disabled={busy}
        value={p.positionTraining || ''}
        onChange={(e) => void act({ type: 'positionTraining', id: p.id, position: e.target.value })}
      >
        <option value="" disabled>
          배치 포지션 자동 훈련
        </option>
        {options.map((pos) => (
          <option key={pos} value={pos}>
            {positionLabels[pos]} · {Math.round(familiarity(p, pos))}%
          </option>
        ))}
      </select>
    </label>
  );
}
export function TacticalBoard({ g, act, busy, onPlayer }: Props) {
  const [name, setName] = useState('');
  const instructionKey = JSON.stringify([g.tactic, g.instructions]);
  const [draft, setDraft] = useState<{ key: string; value: TeamInstructions } | null>(null);
  const instructions =
    draft?.key === instructionKey ? draft.value : g.instructions || defaults(g.tactic);
  const setInstructions = (value: TeamInstructions) => setDraft({ key: instructionKey, value });
  const batters = g.lineup.map((id) => g.roster.find((p) => p.id === id)!).filter(Boolean),
    active = firstTeam(g);
  function changeBatter(index: number, id: string) {
    const ids = [...g.lineup],
      old = ids.indexOf(id);
    if (old >= 0) [ids[index], ids[old]] = [ids[old], ids[index]];
    else ids[index] = id;
    void act({ type: 'lineup', ids });
  }
  return (
    <>
      <section className="panel tactic-library">
        <div>
          <h2>전술 보관함</h2>
          <small>타순·수비 배치·선발·팀 지시를 함께 저장합니다.</small>
        </div>
        <input
          aria-label="저장할 전술 이름"
          maxLength={30}
          placeholder="예: 좌완 상대 · 기동력"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="button primary compact"
          disabled={busy || !name.trim()}
          onClick={async () => {
            if (await act({ type: 'saveTactic', name })) setName('');
          }}
        >
          현재 전술 저장
        </button>
        <div className="saved-tactics">
          {g.tacticBook?.map((t) => (
            <div key={t.id}>
              <button disabled={busy} onClick={() => void act({ type: 'loadTactic', id: t.id })}>
                {t.name}
              </button>
              <button
                aria-label={`${t.name} 삭제`}
                disabled={busy}
                onClick={() => void act({ type: 'deleteTactic', id: t.id })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="tactics-layout">
        <div>
          <section className="panel">
            <div className="panel-header">
              <h2>수비 · 선발</h2>
              <span>전술 숙련도 {Math.round(g.tacticFamiliarity ?? 55)}%</span>
            </div>
            <DefensiveField g={g} act={act} busy={busy} onPlayer={onPlayer} />
            <div className="panel-content">
              <label className="label">
                다음 경기 선발
                <select
                  className="management-select"
                  aria-label="선발 투수"
                  value={g.starter}
                  disabled={busy}
                  onChange={(e) => void act({ type: 'starter', id: e.target.value })}
                >
                  {active
                    .filter((p) => p.pos === 'P')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · 컨디션 {Math.round(p.condition)}%
                      </option>
                    ))}
                </select>
              </label>
              <p className="tiny">
                낯선 포지션에서는 수비력이 낮아집니다. 훈련과 출전으로 숙련도가 오릅니다. 투수
                보직과 로테이션은 아래 투수 운용에서 지정합니다.
              </p>
            </div>
          </section>
          <section className="panel training-block">
            <div className="panel-header">
              <h2>팀 지시</h2>
              <span>프리셋 선택 후 조정 가능</span>
            </div>
            <div className="preset-buttons">
              {Object.entries(presetNames).map(([value, label]) => (
                <button
                  key={value}
                  className={g.tactic === value ? 'selected' : ''}
                  disabled={busy}
                  onClick={() => void act({ type: 'tactic', value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="instruction-sliders">
              {(
                [
                  ['steal', '도루 시도', '적극적일수록 도루와 도루 실패 증가'],
                  ['patience', '선구안', '볼넷 확률 증가'],
                  ['power', '장타 지향', '홈런과 삼진 증가 · 컨택 감소'],
                  ['depth', '수비 깊이', '전진 시 장타 위험 증가 · 깊은 배치 시 수비 부담 증가'],
                ] as const
              ).map(([key, label, hint]) => (
                <label key={key}>
                  <span>
                    {label}
                    <b>{instructions[key]}</b>
                  </span>
                  <input
                    aria-label={label}
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    disabled={busy}
                    value={instructions[key]}
                    onChange={(e) =>
                      setInstructions({ ...instructions, [key]: Number(e.target.value) })
                    }
                  />
                  <small>{hint}</small>
                </label>
              ))}
              <button
                className="button primary compact"
                disabled={busy}
                onClick={() => void act({ type: 'instructions', value: instructions })}
              >
                팀 지시 적용
              </button>
              <p className="tiny">
                큰 전술 변경은 숙련도를 낮춥니다. 적용한 지시만 전술 보관함에 저장됩니다.
              </p>
            </div>
          </section>
        </div>
        <section className="panel">
          <div className="panel-header">
            <h2>선발 타순</h2>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void act({ type: 'auto' })}
            >
              코치 추천
            </button>
          </div>
          <div className="management-lineup">
            {batters.map((p, i) => (
              <div key={p.id}>
                <b>{i + 1}</b>
                <div>
                  <select
                    aria-label={`${i + 1}번 타자`}
                    value={p.id}
                    disabled={busy}
                    onChange={(e) => changeBatter(i, e.target.value)}
                  >
                    {active
                      .filter((v) => v.pos !== 'P')
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} · {v.pos}
                        </option>
                      ))}
                  </select>
                  <button className="text-button" onClick={() => onPlayer(p)}>
                    능력 {ratingText(p)} · 컨디션 {Math.round(p.condition)}%
                  </button>
                  <small className="lineup-reason">{lineupReason(p, i)}</small>
                </div>
                <div className="lineup-arrows">
                  <button
                    aria-label={`${p.name} 타순 올리기`}
                    disabled={busy || i === 0}
                    onClick={() => changeBatter(i, g.lineup[i - 1])}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`${p.name} 타순 내리기`}
                    disabled={busy || i === 8}
                    onClick={() => changeBatter(i, g.lineup[i + 1])}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="panel-content tiny">
            타순을 바꿔도 기존 선수의 수비 위치는 유지됩니다. 벤치 선수와 교체하면 수비 배치를 다시
            확인하세요.
          </div>
        </section>
      </div>
      <PitchingPanel g={g} act={act} busy={busy} onPlayer={onPlayer} />
    </>
  );
}
export function ReservePanel({ g, act, busy, onPlayer }: Props) {
  const { getClub } = useWorld();
  const [tab, setTab] = useState('reserve'),
    [query, setQuery] = useState('');
  const active = firstTeam(g),
    reserve = reserveTeam(g),
    r = g.reserve;
  const list = (tab === 'reserve' ? reserve : active)
    .filter((p) => p.name.includes(query))
    .sort((a, b) => overall(b) - overall(a));
  return (
    <>
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">1군 등록</div>
          <div className="metric-value">
            {active.length}
            <small> / 28명</small>
          </div>
          <span>정규시즌 · 연습경기 출전</span>
        </div>
        <div className="metric">
          <div className="metric-top">2군 선수단</div>
          <div className="metric-value">{reserve.length}명</div>
          <span>3일마다 육성 경기 자동 진행</span>
        </div>
        <div className="metric">
          <div className="metric-top">2군 성적</div>
          <div className="metric-value">
            {r?.w || 0}승 {r?.l || 0}패
          </div>
          <span>{r?.d || 0}무 · 1군 성적과 별도</span>
        </div>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div className="preset-buttons">
            <button
              className={tab === 'reserve' ? 'selected' : ''}
              onClick={() => setTab('reserve')}
            >
              2군 · 육성
            </button>
            <button className={tab === 'first' ? 'selected' : ''} onClick={() => setTab('first')}>
              1군 · 등록 관리
            </button>
          </div>
          <input
            aria-label="등록 선수 검색"
            placeholder="선수 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th>선수</th>
                <th>{g.rules?.revealPotential ? '능력 / 잠재력' : '능력'}</th>
                <th>컨디션</th>
                <th>2군 출전</th>
                <th>AVG / ERA</th>
                <th>개인 훈련</th>
                <th>등록</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const s = p.reserveStats || blankStats();
                return (
                  <tr key={p.id}>
                    <td>
                      <button className="text-button" onClick={() => onPlayer(p)}>
                        {p.name}
                      </button>
                      <small>
                        {p.pos} · {p.real ? '실명' : '가상'} · {p.ageEstimated ? '게임 나이 ' : ''}
                        {p.age}세
                      </small>
                    </td>
                    <td>
                      {ratingText(p)}
                      {g.rules?.revealPotential && <> / {potentialText(p)}</>}
                    </td>
                    <td>{Math.round(p.condition)}%</td>
                    <td>{s.g}경기</td>
                    <td>
                      {p.pos === 'P'
                        ? s.outs
                          ? ((s.er * 27) / s.outs).toFixed(2)
                          : '–'
                        : s.ab
                          ? (s.h / s.ab).toFixed(3)
                          : '–'}
                    </td>
                    <td>
                      <PositionTraining p={p} act={act} busy={busy} />
                    </td>
                    <td>
                      <button
                        className="button secondary compact"
                        disabled={busy}
                        onClick={() =>
                          void act({
                            type: 'squad',
                            id: p.id,
                            value: p.squad === 'reserve' ? 'first' : 'reserve',
                          })
                        }
                      >
                        {p.squad === 'reserve' ? '1군 등록 ↑' : '2군 이동 ↓'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="panel-content tiny">
          게임 공통 규칙: 1군 최대 28명. 포지션별 최소 인원을 유지해야 합니다. 2군 경기는 별도 육성
          일정이며 실제 퓨처스·마이너리그 운영 규정과는 다릅니다. 출전한 유망주는 코치 지도에 따라
          성장합니다.
        </p>
      </section>
      <section className="panel training-block">
        <div className="panel-header">
          <h2>2군 경기 결과</h2>
          <span>최근 {r?.history.length || 0}경기</span>
        </div>
        {r?.history.length ? (
          r.history.slice(0, 12).map((m) => (
            <div className="reserve-result" key={m.day}>
              <span>{dayLabel(m.day)}</span>
              <strong>{getClub(g.club).short} 2군</strong>
              <b>
                {m.own} : {m.against}
              </b>
              <strong>{getClub(m.opponent).short} 2군</strong>
              <small>{m.played.length}명 출전</small>
            </div>
          ))
        ) : (
          <p className="panel-content muted">
            날짜를 진행하면 2군 경기 결과와 선수 기록이 쌓입니다. 타자 9명과 투수가 필요합니다.
          </p>
        )}
      </section>
    </>
  );
}
export function CoachPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { coachPool, getClub } = useWorld();
  const [role, setRole] = useState('타격'),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState('real'),
    [page, setPage] = useState(0);
  const candidates = coachPool(g.year).filter(
    (c) =>
      (c.real || c.role === role) &&
      (kind === 'all' || (kind === 'real' ? c.real : !c.real)) &&
      `${c.name} ${getClub(c.sourceClub || '')?.name || ''}`.includes(query),
  );
  const pages = Math.max(1, Math.ceil(candidates.length / 12)),
    current = Math.min(page, pages - 1);
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <h2>코칭 스태프</h2>
          <span>게임 내 담당 보직</span>
        </div>
        <div className="staff-summary">
          {coachRoles.map((role) => {
            const c = g.staff.find((c) => c.role === role);
            return (
              <div key={role}>
                <small>{role} 코치</small>
                <strong>{c?.name || '공석'}</strong>
                <span>
                  {c?.real ? '실명' : '가상'} · 능력 {c?.skill || 35}
                </span>
                <small>연봉 {money(c?.salary || 0)}</small>
                {c?.real && (
                  <a href={c.source} target="_blank" rel="noreferrer">
                    등록 소속: {getClub(c.sourceClub || '')?.name} ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel training-block">
        <div className="panel-header">
          <h2>코치 영입</h2>
          <span>계약금: 연봉의 50%</span>
        </div>
        <div className="coach-filters">
          <label>
            선임할 보직
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(0);
              }}
            >
              {coachRoles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            코치 구분
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(0);
              }}
            >
              <option value="real">실명 코치</option>
              <option value="generated">가상 코치</option>
              <option value="all">전체 코치</option>
            </select>
          </label>
          <input
            aria-label="코치 이름 또는 소속 검색"
            placeholder="이름 또는 등록 소속 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th>코치</th>
                <th>공식 등록 소속</th>
                <th>능력</th>
                <th>연봉</th>
                <th>선임</th>
              </tr>
            </thead>
            <tbody>
              {candidates.slice(current * 12, current * 12 + 12).map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <small>
                      {c.real ? '실명' : '가상'} · {c.real ? c.verifiedRole : c.style}
                    </small>
                  </td>
                  <td>
                    {c.source ? (
                      <a href={c.source} target="_blank" rel="noreferrer">
                        {getClub(c.sourceClub || '')?.name} ↗
                      </a>
                    ) : (
                      '가상 후보'
                    )}
                  </td>
                  <td>{c.skill}</td>
                  <td>{money(c.salary)}</td>
                  <td>
                    <button
                      className="button secondary compact"
                      disabled={busy || g.staff.some((s) => s.id === c.id)}
                      onClick={() => void act({ type: 'coach', id: c.id, role })}
                    >
                      {g.staff.some((s) => s.id === c.id)
                        ? '선임됨'
                        : `${role} 선임 · ${money(c.salary * 0.5)}`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>{candidates.length}명</span>
          <div>
            <button
              aria-label="이전 코치 목록"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              ←
            </button>
            <span>
              {current + 1} / {pages}
            </span>
            <button
              aria-label="다음 코치 목록"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              →
            </button>
          </div>
        </div>
        <p className="panel-content tiny">
          실명 코치는 KBO 2026년 9월 7일 등록 명단 기준입니다. 이름·등록 소속·코치 신분은 공식
          자료이며, 능력·연봉·게임 담당 보직은 게임 설정입니다. 선임하면 선택한 보직의 기존 코치가
          교체됩니다.
        </p>
      </section>
      <section className="panel training-block">
        <div className="panel-header">
          <h2>팀 훈련</h2>
          <span>1군·2군 모두 적용</span>
        </div>
        <div className="preset-buttons training-presets">
          {Object.entries({
            balanced: '균형 훈련',
            power: '장타 훈련',
            pitching: '투구 훈련',
            defense: '수비 훈련',
            rest: '회복',
          }).map(([value, label]) => (
            <button
              key={value}
              className={g.training === value ? 'selected' : ''}
              disabled={busy}
              onClick={() => void act({ type: 'training', value })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="panel-content tiny">
          타격·투수 코치는 해당 능력 성장, 수비 코치는 수비와 포지션 숙련도, 체력 코치는 회복,
          스카우트는 잠재력 평가에 영향을 줍니다.
        </p>
      </section>
    </>
  );
}
