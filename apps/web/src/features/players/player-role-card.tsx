import Link from 'next/link';
import { Heart, ShieldCheck, Sparkles } from 'lucide-react';
import type { GameState, Player } from '@dugout/shared/types';
import { defensivePositions, familiarity } from '@dugout/shared/management';
import { lineupReason } from '@dugout/shared/player-attributes';
import { pitcherResource } from '@dugout/shared/pitching';
import { playerClubStanding } from '@dugout/shared/trade-policy';
import {
  RoleBadge,
  RoleSelect,
  assignmentLabel,
  pitchingAssignment,
  roleHelp,
} from '../squad/pitching-panel';
import { PositionTraining } from '../squad/management-panels';
import { RosterMoveControl } from '../squad/roster-moves';
import type { Act } from '../career/game-contracts';
export function PlayerRoleCard({
  player: p,
  game: g,
  busy,
  act,
}: {
  player: Player;
  game: GameState;
  busy: boolean;
  act: Act;
}) {
  const mood = Math.round(p.mood?.value ?? 65),
    role = pitchingAssignment(g, p),
    standing = playerClubStanding(p, g.roster),
    slot = g.lineup.indexOf(p.id);
  return (
    <section className="player-role-workspace">
      <header>
        <div>
          <small>우리 팀에서의 역할</small>
          <h3>{standing.label}</h3>
        </div>
        <span className="pill">{p.squad === 'reserve' ? '2군' : '1군'} 등록</span>
      </header>
      <div className="player-role-columns">
        <section className="player-role-assignment">
          <h4>
            <ShieldCheck size={17} /> 기용 계획
          </h4>
          {p.pos === 'P' ? (
            <>
              <div className="player-role-badges">
                <RoleBadge role={role}>{assignmentLabel(g, p)}</RoleBadge>
                {g.starter === p.id && <span>다음 경기 선발</span>}
              </div>
              <p>{roleHelp[role || 'bullpen']}</p>
              <label className="player-role-control">
                현재 보직
                <RoleSelect g={g} p={p} busy={busy} act={act} />
              </label>
              <div className="player-role-advice">
                <Sparkles size={16} />
                <div>
                  <strong>코치 판단 · {pitcherResource(p).resource}</strong>
                  <p>{pitcherResource(p).reason}</p>
                  {p.condition < 65 && (
                    <p>체력이 부족합니다. 보직을 유지하고 다음 등판은 쉬게 하는 편이 좋겠습니다.</p>
                  )}
                </div>
              </div>
              <Link className="text-button" href="/?view=tactics&panel=pitching">
                투수진 추천 배치 · 로테이션 보기 →
              </Link>
            </>
          ) : (
            <>
              <strong>{slot >= 0 ? `${slot + 1}번 타자` : '벤치 대기'}</strong>
              <p>
                {slot >= 0
                  ? lineupReason(p, slot)
                  : '상대 투수와 수비 위치에 맞춰 교체 출전을 준비합니다.'}
              </p>
              <PositionTraining p={p} act={act} busy={busy} />
            </>
          )}
        </section>
        <section className="player-role-care">
          <h4>
            <Heart size={17} /> 선수 상태
          </h4>
          <div className="player-morale-number">
            <strong>{mood}</strong>
            <span>
              {mood >= 75
                ? '만족하고 있어요'
                : mood < 45
                  ? '면담이 필요해요'
                  : '무난하게 지내고 있어요'}
            </span>
          </div>
          <progress value={mood} max={100} aria-label="선수 사기" />
          <p>{p.mood?.reason || '선수의 출전 기회와 컨디션을 함께 관리해 주세요.'}</p>
          <div className="player-position-levels">
            {defensivePositions
              .filter((pos) => (pos === 'P') === (p.pos === 'P'))
              .map((pos) => (
                <span key={pos}>
                  <b>{pos}</b>
                  <strong>{Math.round(familiarity(p, pos))}%</strong>
                </span>
              ))}
          </div>
          <div className="player-role-registration">
            <strong>1군 · 2군 등록</strong>
            <RosterMoveControl player={p} g={g} act={act} busy={busy} />
          </div>
        </section>
      </div>
    </section>
  );
}
