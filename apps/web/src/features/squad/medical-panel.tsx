'use client';
import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { MedicalDecision } from './medical-decision';
export function MedicalPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const players = g.roster.filter((p) => p.injury);
  return (
    <section className="panel panel-content medical-overview">
      <h2>의무팀 보고</h2>
      <p>부상 {players.length}명 · 치료와 재활 중인 선수는 경기 명단에서 제외됩니다.</p>
      {!players.length && <p>현재 치료 중인 선수가 없습니다.</p>}
      {players.map((p) => (
        <MedicalDecision key={p.id} g={g} player={p} act={act} busy={busy} />
      ))}
      <Link className="text-button" href="/?view=reserves">
        1군 · 2군에서 대체 선수 등록
      </Link>
    </section>
  );
}
