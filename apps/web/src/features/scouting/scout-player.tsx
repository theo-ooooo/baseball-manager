'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Binoculars, Star } from 'lucide-react';
import type { GameState, Player } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { scoutingCost, scoutingDurations } from '@dugout/shared/scouting';
import type { Act } from '../career/game-contracts';
import { ScoutReportCard } from './scout-report';

export function ScoutPlayer({
  player,
  g,
  act,
  busy,
}: {
  player: Player;
  g: GameState;
  act: Act;
  busy: boolean;
}) {
  const [days, setDays] = useState(14);
  const scout = g.staff.find((c) => c.role === '스카우트');
  const listed = g.scouting?.shortlist.includes(player.id) ?? false;
  const active = g.scouting?.assignments.find(
    (t) => t.status === 'active' && 'playerId' in t.target && t.target.playerId === player.id,
  );
  const report = g.scouting?.reports.find((r) => r.playerId === player.id);
  const cost = scoutingCost(days, false);
  return (
    <section className="scout-player">
      <div className="scout-toolbar">
        <button
          className={`button ${listed ? 'primary' : 'secondary'}`}
          aria-pressed={listed}
          disabled={busy}
          onClick={() => void act({ type: 'shortlistPlayer', id: player.id, add: !listed })}
        >
          <Star size={16} /> {listed ? '관심 명단 등록됨' : '관심 명단에 추가'}
        </button>
        <Link className="text-button" href="/?view=scouting">
          스카우팅 센터 · 비교 →
        </Link>
      </div>
      <div className="scout-assignment-form">
        <h3>
          <Binoculars size={18} /> {player.name} 관찰 의뢰
        </h3>
        {active ? (
          <p>
            담당 {active.scoutName} · {active.due} 보고 예정
          </p>
        ) : (
          <>
            <p>
              {scout
                ? `${scout.name} 스카우트가 능력 범위·강점·우려 사항을 보고합니다.`
                : '스카우트 코치를 선임하면 관찰을 시작할 수 있습니다.'}
            </p>
            <div className="scout-toolbar">
              <div className="contract-year-options" role="group" aria-label="개인 관찰 기간">
                {scoutingDurations.map((d) => (
                  <button
                    key={d}
                    disabled={busy}
                    aria-pressed={days === d}
                    onClick={() => setDays(d)}
                  >
                    {d}일
                  </button>
                ))}
              </div>
              <button
                className="button primary"
                disabled={
                  busy ||
                  !scout ||
                  cost > g.budget ||
                  (g.scouting?.assignments.filter((t) => t.status === 'active').length ?? 0) >= 3
                }
                onClick={() =>
                  void act({ type: 'assignScout', playerId: player.id, scoutId: scout?.id, days })
                }
              >
                관찰 시작 · {money(cost)}
              </button>
            </div>
            <small>파견비는 시작 시 한 번 지급합니다. 취소해도 반환되지 않습니다.</small>
          </>
        )}
      </div>
      {report && <ScoutReportCard report={report} />}
    </section>
  );
}
