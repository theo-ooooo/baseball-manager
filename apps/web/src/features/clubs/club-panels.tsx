'use client';
import { useState } from 'react';
import type { GameState, Player } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { dateLabel } from '@dugout/shared/calendar';
import { useWorld } from '../career/world-context';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
type Act = (a: Record<string, unknown>) => Promise<GameState | null>;
const roleLabels = {
  core: '핵심 선수',
  regular: '주전',
  rotation: '로테이션',
  prospect: '육성 선수',
};
export function Mood({ p }: { p: Player }) {
  const value = Math.round(p.mood?.value ?? 65);
  return (
    <span
      title={p.mood?.reason}
      className={`mood ${value < 45 ? 'unhappy' : value >= 75 ? 'happy' : ''}`}
    >
      {value} · {value < 30 ? '매우 불만' : value < 45 ? '불만' : value >= 75 ? '만족' : '보통'}
    </span>
  );
}
export function DynamicsPanel({ g, onPlayer }: { g: GameState; onPlayer: (p: Player) => void }) {
  const list = [...g.roster].sort((a, b) => (a.mood?.value ?? 65) - (b.mood?.value ?? 65));
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>선수단 분위기</h2>
        <span>출전·성적·감독 약속에 따라 변합니다.</span>
      </div>
      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>
              <th>선수</th>
              <th>기대 역할</th>
              <th>사기</th>
              <th>최근 출전</th>
              <th>현재 생각 / 감독 약속</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <button className="text-button" onClick={() => onPlayer(p)}>
                    {p.name}
                  </button>
                  <small>{p.squad === 'reserve' ? '2군' : '1군'}</small>
                </td>
                <td>{roleLabels[p.mood?.role || 'prospect']}</td>
                <td>
                  <Mood p={p} />
                </td>
                <td>
                  {p.mood?.recent.filter(Boolean).length || 0} / {p.mood?.recent.length || 0}경기
                </td>
                <td>
                  {p.mood?.reason || '새 감독 체제 적응'}
                  {p.mood?.promise && (
                    <small>
                      {dateLabel(g, p.mood.promise.due)}까지 {p.mood.promise.games}경기 약속 · 현재{' '}
                      {p.stats.g - p.mood.promise.startGames}경기
                    </small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-content tiny">
        표시된 기분과 발언은 커리어 안에서 생성된 가상 상태입니다. 실존 선수의 실제 감정이나 발언이
        아닙니다. 낮은 사기는 경기 집중력에 소폭 반영됩니다.
      </p>
    </section>
  );
}
export function OutgoingTransferPanel({
  p,
  g,
  act,
  busy,
}: {
  p: Player;
  g: GameState;
  act: Act;
  busy: boolean;
}) {
  const { getClub } = useWorld(),
    [selected, setSelected] = useState('');
  const listed = g.transferListed?.[p.id] !== undefined,
    offers = (g.saleOffers || []).filter(
      (o) => o.playerId === p.id && o.year === g.year && o.expires >= g.day,
    ),
    offer = offers.find((o) => o.id === selected);
  return (
    <div className="outgoing-transfer">
      <h3>구단 영입 제안</h3>
      <button
        className="button secondary full-width"
        disabled={busy}
        onClick={() => void act({ type: 'listPlayer', id: p.id, value: !listed })}
      >
        {listed ? '이적 명단에서 제외' : '이적 명단 등록 · 관심 구단 확인'}
      </button>
      {!offers.length && (
        <p className="tiny">
          {listed
            ? '관심 구단에 문의 중입니다. 2일 뒤부터 제안이 도착할 수 있으며, 관심이 없으면 주간 보고로 알려드립니다.'
            : '등록 즉시 이적되지 않습니다. 구단이 제시한 금액과 행선지를 확인한 뒤 결정합니다.'}
        </p>
      )}
      {offers.map((o) => (
        <div className="sale-offer" key={o.id}>
          <strong>{getClub(o.club).name}</strong>
          <b>{money(o.fee)}</b>
          <small>{dateLabel(g, o.expires)}까지 · 기존 계약 승계</small>
          <div>
            <button
              className="button primary compact"
              disabled={busy}
              onClick={() => setSelected(o.id)}
            >
              제안 수락
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void act({ type: 'declineSale', id: o.id })}
            >
              거절
            </button>
          </div>
        </div>
      ))}
      <AlertDialog
        open={!!offer}
        onOpenChange={(open) => {
          if (!open) setSelected('');
        }}
      >
        <AlertDialogContent className="confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{p.name} 이적 제안을 수락할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {offer &&
                `${getClub(offer.club).name}으로 이적하며 ${money(offer.fee)}을 받습니다. 같은 포지션의 1군 대체 선수가 필요합니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                if (offer && (await act({ type: 'sell', id: p.id, offerId: offer.id })))
                  setSelected('');
              }}
            >
              이적 확정
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
