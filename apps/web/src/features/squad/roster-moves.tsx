'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeftRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState, Player } from '@dugout/shared/types';
import { firstTeam } from '@dugout/shared/management';
import { FIRST_TEAM_LIMIT, squadMoveError } from '@dugout/shared/roster-rules';
import { overall } from '@dugout/shared/game-view';
import { Rating, SearchBox, positions } from '../../components/game-ui';
import type { Act } from '../career/game-contracts';
import { assignmentLabel } from './pitching-panel';

type Props = { g: GameState; act: Act; busy: boolean };

export function useRosterMoves({ g, act, busy }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const player = g.roster.find((p) => p.id === selected);
  async function move(p: Player) {
    if (busy) return;
    const target = p.squad === 'reserve' ? 'first' : 'reserve';
    if (squadMoveError(g, p.id, target)) {
      setSelected(p.id);
      return;
    }
    const next = await act({ type: 'squad', id: p.id, value: target });
    if (next) toast.success(`${p.name} · ${target === 'first' ? '1군 등록' : '2군 이동'} 완료`);
  }
  return {
    move,
    exchange: (p: Player) => {
      if (!busy) setSelected(p.id);
    },
    dialog: player ? (
      <RosterExchange
        key={player.id}
        {...{ g, act, busy, player }}
        onClose={() => setSelected(null)}
      />
    ) : null,
  };
}

export function RosterMoveControl({ player, ...props }: Props & { player: Player }) {
  const moves = useRosterMoves(props);
  return (
    <>
      <button
        className="button secondary compact"
        disabled={props.busy}
        onClick={() => void moves.move(player)}
      >
        {player.squad === 'reserve' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        {player.squad === 'reserve' ? '1군 등록' : '2군 이동'}
      </button>
      {moves.dialog}
    </>
  );
}

function RosterExchange({
  g,
  act,
  busy,
  player,
  onClose,
}: Props & { player: Player; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const promoting = player.squad === 'reserve';
  const target = promoting ? 'first' : 'reserve';
  const replacement = g.roster.find((p) => p.id === replacementId);
  const error = replacement ? squadMoveError(g, player.id, target, replacement.id) : null;
  const candidates = g.roster
    .filter((p) => (p.squad || 'first') === target && p.name.includes(query))
    .sort(
      (a, b) =>
        Number(b.pos === player.pos) - Number(a.pos === player.pos) ||
        Number(!!squadMoveError(g, player.id, target, a.id)) -
          Number(!!squadMoveError(g, player.id, target, b.id)) ||
        (promoting
          ? a.condition - b.condition || overall(a) - overall(b)
          : overall(b) - overall(a)),
    );
  async function confirm() {
    if (!replacement || error || busy) return;
    const next = await act({
      type: 'squad',
      id: player.id,
      value: target,
      replaceId: replacement.id,
    });
    if (next) {
      toast.success(
        `${promoting ? player.name : replacement.name} 1군 등록 · ${promoting ? replacement.name : player.name} 2군 이동`,
      );
      onClose();
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="roster-exchange-dialog">
        <DialogHeader>
          <DialogTitle>
            {promoting ? '내려갈 선수를 선택하세요' : '함께 올라올 선수를 선택하세요'}
          </DialogTitle>
          <DialogDescription>
            {promoting && firstTeam(g).length >= FIRST_TEAM_LIMIT
              ? '1군 정원이 가득 찼습니다. '
              : ''}
            {player.name} 선수와 한 번에 교체합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="exchange-summary">
          <span className={promoting ? 'up' : 'down'}>
            {promoting ? <ArrowUp size={17} /> : <ArrowDown size={17} />}
          </span>
          <div>
            <strong>{player.name}</strong>
            <small>
              {positions[player.pos]} · {promoting ? '2군 → 1군' : '1군 → 2군'}
            </small>
          </div>
          <Rating value={overall(player)} player={player} />
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="교체 선수 검색" />
        <div
          className="exchange-options"
          role="group"
          aria-label={promoting ? '2군으로 내려갈 선수' : '1군으로 올라올 선수'}
        >
          {candidates.map((p) => {
            const reason = squadMoveError(g, player.id, target, p.id);
            return (
              <button
                key={p.id}
                className="exchange-option"
                aria-pressed={replacementId === p.id}
                disabled={busy || !!reason}
                onClick={() => setReplacementId(p.id)}
              >
                <span className="exchange-check">
                  {replacementId === p.id && <Check size={14} />}
                </span>
                <span className="exchange-player">
                  <strong>
                    {p.name}
                    <small>
                      {positions[p.pos]}
                      {p.pos === player.pos ? ' · 같은 포지션' : ''}
                    </small>
                  </strong>
                  <small>
                    {reason ||
                      `${assignmentLabel(g, p) || (p.squad === 'reserve' ? '2군 선수' : '1군 선수')} · 컨디션 ${Math.round(p.condition)}%`}
                  </small>
                </span>
                <Rating value={overall(p)} player={p} />
              </button>
            );
          })}
          {!candidates.length && <p className="muted">검색 결과가 없습니다.</p>}
        </div>
        <p className="exchange-note">기존 타순과 보직은 가능한 범위에서 유지합니다.</p>
        {error && (
          <p role="alert" className="exchange-error">
            {error}
          </p>
        )}
        <div className="exchange-footer">
          <button className="button secondary" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button
            className="button primary"
            disabled={busy || !replacement || !!error}
            onClick={() => void confirm()}
          >
            <ArrowLeftRight size={15} />
            {busy ? '교체 중' : '두 선수 교체'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
