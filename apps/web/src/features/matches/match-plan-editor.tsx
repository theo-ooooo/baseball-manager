'use client';
import { useEffect, useState } from 'react';
import type { GameState, TeamInstructions } from '@dugout/shared/types';
import { firstTeam, defaults } from '@dugout/shared/management';
import type { Act } from '../career/game-contracts';

export function MatchPlanEditor({
  g,
  cursor,
  busy,
  act,
  onApplied,
  onDirty,
  onCancel,
}: {
  g: GameState;
  cursor: number;
  busy: boolean;
  act: Act;
  onApplied: () => void;
  onDirty: (dirty: boolean) => void;
  onCancel: () => void;
}) {
  const live = g.liveMatch!,
    timeline = live.timeline!;
  const side = live.home === g.club ? 1 : 0,
    team = timeline.replayTeams![side];
  const changes = (live.changes || []).filter((c) => c.cursor <= cursor),
    current = changes.at(-1);
  const initialLineup = current?.lineup || team.lineup;
  const pitched = timeline.log
    .slice(0, cursor)
    .filter((e) => e.half !== side && e.play)
    .map((e) => e.play!.pitcher);
  const activePitcher =
    current?.cursor === cursor ? current.pitcher : pitched.at(-1) || team.defense.P;
  const initialInstructions = current?.instructions || g.instructions || defaults(g.tactic);
  const [lineup, setLineup] = useState([...initialLineup]),
    [pitcher, setPitcher] = useState(activePitcher),
    [instructions, setInstructions] = useState({ ...initialInstructions });
  const [tab, setTab] = useState('players');
  const players = firstTeam(g),
    batters = players.filter((p) => p.pos !== 'P');
  const usedBatters = new Set([
    ...team.lineup,
    ...changes.filter((c) => c.cursor < cursor).flatMap((c) => c.lineup),
  ]);
  const usedPitchers = new Set([team.defense.P, ...pitched]);
  const canPitch = cursor === 0 || timeline.log[cursor]?.half !== side;
  const dirty =
    JSON.stringify(lineup) !== JSON.stringify(initialLineup) ||
    pitcher !== activePitcher ||
    JSON.stringify(instructions) !== JSON.stringify(initialInstructions);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  function replace(slot: number, id: string) {
    const next = [...lineup],
      other = next.indexOf(id);
    if (cursor === 0 && other >= 0) next[other] = next[slot];
    next[slot] = id;
    setLineup(next);
  }
  return (
    <form
      className="match-plan"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await act({
            type: 'reviseMatch',
            cursor,
            timelineVersion: live.timelineVersion,
            lineup,
            pitcher,
            instructions,
          })
        )
          onApplied();
      }}
    >
      <h3>{cursor === 0 ? '경기 프리뷰 · 선수와 전술' : '선수 교체 · 전술 변경'}</h3>
      <p className="tiny">
        {cursor === 0
          ? '타순·선발·팀 지시를 확정하고 플레이볼을 누르세요.'
          : '이미 진행된 타석은 유지됩니다. 변경은 다음 타석부터 적용됩니다.'}
      </p>
      <div className="match-plan-tabs" aria-label="경기 계획 편집">
        <button type="button" aria-pressed={tab === 'players'} onClick={() => setTab('players')}>
          선수
        </button>
        <button type="button" aria-pressed={tab === 'tactics'} onClick={() => setTab('tactics')}>
          팀 전술
        </button>
      </div>
      <fieldset disabled={busy} hidden={tab !== 'players'}>
        <legend>타순 · {cursor === 0 ? '선발 라인업' : '벤치 선수 투입'}</legend>
        {lineup.map((id, slot) => (
          <label className="match-plan-slot" key={slot}>
            <span>{slot + 1}번</span>
            <select
              aria-label={`${slot + 1}번 타자`}
              value={id}
              onChange={(e) => replace(slot, e.target.value)}
            >
              {batters.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={
                    cursor > 0 && p.id !== id && (usedBatters.has(p.id) || lineup.includes(p.id))
                  }
                >
                  {p.name} · {p.pos} · {Math.round(p.condition)}%
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="match-plan-pitcher">
          {cursor === 0 ? '선발투수' : '등판 투수'}
          <select
            aria-label={cursor === 0 ? '프리뷰 선발투수' : '교체 투수'}
            value={pitcher}
            disabled={!canPitch}
            onChange={(e) => setPitcher(e.target.value)}
          >
            {players
              .filter((p) => p.pos === 'P')
              .map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={cursor > 0 && p.id !== activePitcher && usedPitchers.has(p.id)}
                >
                  {p.name} · {Math.round(p.condition)}%
                </option>
              ))}
          </select>
        </label>
        {!canPitch && <p className="tiny">투수는 우리 팀 수비 타석 직전에 교체할 수 있습니다.</p>}
      </fieldset>
      <fieldset disabled={busy} hidden={tab !== 'tactics'}>
        <legend>팀 지시</legend>
        <div className="match-plan-instructions">
          {(
            [
              ['steal', '도루 적극성'],
              ['patience', '선구안'],
              ['power', '장타 지향'],
              ['depth', '수비 깊이'],
            ] as [keyof TeamInstructions, string][]
          ).map(([key, label]) => (
            <label key={key}>
              <span>
                {label}
                <b>{instructions[key]}</b>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                aria-label={label}
                value={instructions[key]}
                onChange={(e) =>
                  setInstructions({ ...instructions, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className="button primary" disabled={busy || !dirty}>
        {busy
          ? '경기 계획 반영 중…'
          : cursor === 0
            ? '프리뷰 변경 적용'
            : '변경 적용 · 이후 경기 갱신'}
      </button>
      <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>
        {dirty ? '변경 취소' : '편집 닫기'}
      </button>
    </form>
  );
}
