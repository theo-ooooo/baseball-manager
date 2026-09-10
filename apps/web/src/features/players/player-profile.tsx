'use client';
import { ClubBadge } from '../../components/club-badge';

import { useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GameState, Player, Stats } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { PlayerContractRoom } from '../contracts/player-contract-room';
import { potentialText, ratingText } from '@dugout/shared/ratings';
import { lineupReason } from '@dugout/shared/player-attributes';
import { defensivePositions, familiarity } from '@dugout/shared/management';
import {
  LOW_CONDITION,
  REPLACEMENT_NOTE,
  RoleBadge,
  RoleSelect,
  assignmentLabel,
  pitchingAssignment,
  roleHelp,
} from '../squad/pitching-panel';
import { useWorld } from '../career/world-context';
import { Mood, OutgoingTransferPanel } from '../clubs/club-panels';
import { PositionTraining } from '../squad/management-panels';
import { RosterMoveControl } from '../squad/roster-moves';
import { DevelopmentPanel } from './development-panel';
import { ScoutPlayer } from '../scouting/scout-player';
import { PlayerAttributes, PlayerGrowth } from './growth-indicator';
import { TrainingPlanForm } from './training-plan-form';
import { CareerRecords } from './career-records';
import { PlayerPortrait } from './player-portrait';
import { officialPortrait } from '@dugout/shared/player-portrait';

type Props = {
  player: Player;
  game: GameState;
  busy: boolean;
  act: (action: Record<string, unknown>) => Promise<GameState | null>;
};
const positionNames = { P: '투수', C: '포수', IF: '내야수', OF: '외야수', DH: '지명타자' };
const innings = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`;

function SeasonStats({ stats, pitcher }: { stats: Stats; pitcher: boolean }) {
  return (
    <div>
      <p>
        {pitcher
          ? `${stats.g}경기 · ${innings(stats.outs)}이닝 · ${stats.wins}승 · ${stats.saves || 0}세이브 · ${stats.holds || 0}홀드 · ERA ${stats.outs ? ((stats.er * 27) / stats.outs).toFixed(2) : '—'}`
          : `${stats.g}경기 · ${stats.ab}타수 · ${stats.h}안타 · ${stats.hr}홈런 · ${stats.rbi}타점 · AVG ${stats.ab ? (stats.h / stats.ab).toFixed(3) : '—'}`}
      </p>
      {!pitcher && (
        <p className="tiny">
          추가 집계 · 도루 {stats.sb ?? '—'} · 도루 실패 {stats.cs ?? '—'} · 희생번트{' '}
          {stats.sh ?? '—'} (기능 추가 전 기록은 포함하지 않습니다.)
        </p>
      )}
    </div>
  );
}

function PerformanceEvidence({ player }: { player: Player }) {
  const record = player.rating?.record;
  if (!record)
    return (
      <p className="muted">
        {player.real
          ? '확인된 공식 시즌 성적이 없습니다.'
          : '가상 선수의 능력은 게임에서 생성됩니다.'}
      </p>
    );
  const facts: [string, string | number | undefined][] =
    record.kind === 'pitch'
      ? [
          ['등판', record.g],
          ['선발', record.gs],
          ['이닝', innings(record.outs || 0)],
          ['탈삼진', record.k],
          ['볼넷', record.bb],
          ['피홈런', record.hr],
          ['세이브', record.sv],
          ['홀드', record.hld],
        ]
      : [
          ['타석', record.pa],
          ['타수', record.ab],
          ['안타', record.h],
          ['홈런', record.hr],
          ['볼넷', record.bb],
          ['삼진', record.k],
          ['도루', record.sb],
          ['도루 실패', record.cs],
          ['출루율', record.obp?.toFixed(3)],
          ['장타율', record.slg?.toFixed(3)],
        ];
  return (
    <section className="profile-evidence">
      <h3>
        {record.season} 공식 시즌 성적 · {record.league.toUpperCase()}
      </h3>
      <dl className="profile-stat-grid">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? '미확인'}</dd>
          </div>
        ))}
      </dl>
      <a href={record.source} target="_blank" rel="noreferrer">
        공식 성적 출처 ↗
      </a>
    </section>
  );
}

function ContractPanel({ player, game, busy, act }: Props) {
  const own = game.roster.some((p) => p.id === player.id);
  return (
    <>
      <PlayerContractRoom player={player} g={game} act={act} busy={busy} />
      {own && <OutgoingTransferPanel p={player} g={game} act={act} busy={busy} />}
    </>
  );
}

export function PlayerProfile(props: Props) {
  const { player, game, act, busy } = props;
  const { getClub } = useWorld();
  const own = game.roster.some((p) => p.id === player.id);
  const slot = game.lineup.indexOf(player.id);
  const [tab, setTab] = useState('profile');
  const portrait = officialPortrait(player);
  return (
    <article className="panel player-page">
      <header className="profile-header">
        {getClub(player.club) && <ClubBadge club={getClub(player.club)} size="large" />}
        <PlayerPortrait player={player} size="large" />
        <div>
          <span className={player.real ? 'real-tag' : 'gen-tag'}>
            {player.real ? '실명 선수' : '가상 선수'}
          </span>
          <h2>{player.name}</h2>
          <p>
            {player.original !== player.name && `${player.original} · `}
            {positionNames[player.pos]} · {player.ageEstimated ? '게임 나이 ' : ''}
            {player.age}세 ·{' '}
            {player.club === 'fa' ? (
              'FA · 자유계약'
            ) : (
              <Link href={`/clubs/${encodeURIComponent(player.club)}`}>
                {getClub(player.club)?.name}
              </Link>
            )}
            {own && player.pos === 'P' && (
              <>
                {' · '}
                <RoleBadge role={pitchingAssignment(game, player)}>
                  {assignmentLabel(game, player)}
                </RoleBadge>
              </>
            )}
          </p>
        </div>
        <div className="profile-rating-trend">
          <span className="rating">{ratingText(player)}</span>
          {own && <PlayerGrowth player={player} />}
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="profile-tabs" variant="line">
          <TabsTrigger value="profile">프로필 · 세부 능력</TabsTrigger>
          <TabsTrigger value="records">성적</TabsTrigger>
          {own && <TabsTrigger value="development">성장 기록</TabsTrigger>}
          {!own && <TabsTrigger value="scouting">관찰 · 관심 명단</TabsTrigger>}
          <TabsTrigger value="contract">{own ? '계약 · 이적' : '계약 협상'}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <div className="profile-facts">
            <div>
              <small>연봉 · 게임 설정</small>
              <strong>{money(player.salary)}</strong>
            </div>
            <div>
              <small>계약 잔여</small>
              <strong>{player.years}년</strong>
            </div>
            <div>
              <small>컨디션</small>
              <strong>{Math.round(player.condition)}%</strong>
            </div>
            {game.rules?.revealPotential && (
              <div>
                <small>잠재력 · 추정</small>
                <strong>{potentialText(player)}</strong>
              </div>
            )}
          </div>
          {player.observation && (
            <p className="rule-notice">
              {player.observation.status === 'unknown'
                ? '낯선 리그의 선수입니다. 능력치는 ?로 표시됩니다. 스카우트를 파견해 관찰 보고를 받아보세요.'
                : `${player.observation.date} 스카우트 보고의 평가 범위입니다. 실제 능력치는 공개되지 않습니다.`}
            </p>
          )}
          <PlayerAttributes player={player} owned={own} />
          {own && (
            <section className="profile-development">
              <h3>선수단 역할</h3>
              <Mood p={player} />
              <p>{player.mood?.reason}</p>
              {player.pos === 'P' ? (
                <div className="ui-scope ui-profile-role">
                  <div className="ui-profile-role-head">
                    <RoleBadge role={pitchingAssignment(game, player)}>
                      {assignmentLabel(game, player)}
                    </RoleBadge>
                    {game.starter === player.id && <b className="ui-next-tag">다음 경기 선발</b>}
                    {player.condition < LOW_CONDITION && (
                      <b className="ui-next-tag ui-warn">체력 부족 · 휴식 권장</b>
                    )}
                  </div>
                  <p>
                    {roleHelp[pitchingAssignment(game, player) || 'bullpen']}
                    {pitchingAssignment(game, player) !== 'reserve' && ` ${REPLACEMENT_NOTE}`}
                  </p>
                  <RoleSelect g={game} p={player} busy={busy} act={act} />
                  <Link className="text-button" href="/?view=tactics&panel=pitching">
                    투수 운용 · 로테이션 순서 →
                  </Link>
                </div>
              ) : (
                <p>
                  {slot >= 0
                    ? `${slot + 1}번 · ${lineupReason(player, slot)}`
                    : '벤치 · 타순 미등록'}
                </p>
              )}
              <PositionTraining p={player} act={act} busy={busy} />
              <RosterMoveControl player={player} g={game} act={act} busy={busy} />
              <dl className="profile-stat-grid">
                {defensivePositions
                  .filter((pos) => (pos === 'P') === (player.pos === 'P'))
                  .map((pos) => (
                    <div key={pos}>
                      <dt>{pos} 숙련</dt>
                      <dd>{Math.round(familiarity(player, pos))}%</dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
          <p className="profile-note">
            실명 선수는 확인된 공식 성적을 표본 크기로 보정한 게임 평가입니다. 수비·송구·구종·구속
            등 확인하지 못한 항목은 미평가로 표시합니다. 주력은 도루 성적을 참고한 추정입니다. 종합
            능력은 주요 능력의 가중 평균이며 모든 세부 지표를 합친 수치는 아닙니다.
            {player.rating?.status === 'provisional' && ' 100타석·30이닝 미만의 잠정 평가입니다.'}
            {game.rules?.revealPotential && ' 잠재력은 성적과 나이에 따른 추정입니다.'}
          </p>
          {player.source && (
            <a href={player.source} target="_blank" rel="noreferrer">
              선수 명단 출처 ↗
            </a>
          )}
          {portrait && (
            <a
              className="profile-photo-source"
              href={portrait.sourcePage}
              target="_blank"
              rel="noreferrer"
            >
              공식 사진 출처 · {portrait.league.toUpperCase()} ↗
            </a>
          )}
        </TabsContent>
        <TabsContent value="records">
          <CareerRecords playerId={player.id} current={player} year={game.year} />
          <PerformanceEvidence player={player} />
          <section className="profile-evidence">
            <h3>게임 내 1군 시즌 기록</h3>
            <SeasonStats stats={player.stats} pitcher={player.pos === 'P'} />
            {player.reserveStats && (
              <>
                <h3>게임 내 2군 시즌 기록</h3>
                <SeasonStats stats={player.reserveStats} pitcher={player.pos === 'P'} />
              </>
            )}
          </section>
        </TabsContent>
        <TabsContent value="contract">
          <ContractPanel {...props} />
        </TabsContent>
        {!own && (
          <TabsContent value="scouting">
            <ScoutPlayer player={player} g={game} act={act} busy={busy} />
          </TabsContent>
        )}
        {own && (
          <TabsContent value="development">
            <TrainingPlanForm
              key={JSON.stringify(player.trainingPlan) || player.id}
              player={player}
              g={game}
              act={act}
              busy={busy}
            />
            <DevelopmentPanel player={player} game={game} />
          </TabsContent>
        )}
      </Tabs>
    </article>
  );
}
