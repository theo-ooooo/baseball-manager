'use client';
import { ratingText } from '@dugout/shared/ratings';
import { lineupReason } from '@dugout/shared/player-attributes';
import { PitchingPanel } from './pitching-panel';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { DefensivePosition, GameState, Player, TeamInstructions } from '@dugout/shared/types';
import {
  defaults,
  defenseFor,
  defensivePositions,
  familiarity,
  firstTeam,
  positionLabels,
} from '@dugout/shared/management';

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
        <option value="">배치 포지션 자동 훈련</option>
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
  const router = useRouter();
  const requestedPanel = useSearchParams().get('panel');
  const panel =
    requestedPanel === 'pitching' || requestedPanel === 'library' ? requestedPanel : 'lineup';
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
    <Tabs
      value={panel}
      onValueChange={(value) => router.replace(`/?view=tactics&panel=${value}`, { scroll: false })}
    >
      <TabsList variant="line" aria-label="전술 관리">
        <TabsTrigger value="lineup">타순 · 수비</TabsTrigger>
        <TabsTrigger value="pitching">투수 운용</TabsTrigger>
        <TabsTrigger value="library">전술 보관함</TabsTrigger>
      </TabsList>
      <TabsContent value="library">
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
      </TabsContent>
      <TabsContent value="lineup">
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
                  보직과 로테이션은 투수 운용 탭에서 지정합니다.
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
              타순을 바꿔도 기존 선수의 수비 위치는 유지됩니다. 벤치 선수와 교체하면 수비 배치를
              다시 확인하세요.
            </div>
          </section>
        </div>
      </TabsContent>
      <TabsContent value="pitching">
        <PitchingPanel g={g} act={act} busy={busy} onPlayer={onPlayer} />
      </TabsContent>
    </Tabs>
  );
}
