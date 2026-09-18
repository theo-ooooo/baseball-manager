'use client';
import { PlayerRemodelPanel } from './player-remodel-panel';
import { PlayerRoleCard } from './player-role-card';
import { nationalCountry } from '@dugout/shared/international';
import { ClubBadge } from '../../components/club-badge';

import { usePlayerProfile } from './use-player-profile';
import { PlayerOverview } from './player-overview';
import { countryFlags, countryPath } from '@dugout/shared/countries';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GameState, Player, Stats } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { PlayerContractRoom } from '../contracts/player-contract-room';
import { potentialText, ratingText, ratingBasis } from '@dugout/shared/ratings';
import { playerPosition } from '@dugout/shared/management';
import { RoleBadge, assignmentLabel, pitchingAssignment } from '../squad/pitching-panel';
import { useWorld } from '../career/world-context';
import { OutgoingTransferPanel } from '../clubs/club-panels';
import { DevelopmentPanel } from './development-panel';
import { ScoutPlayer } from '../scouting/scout-player';
import { PlayerAttributes, PlayerGrowth } from './growth-indicator';
import { TrainingPlanForm } from './training-plan-form';
import { CareerRecords } from './career-records';
import { PlayerPortrait } from './player-portrait';
import { officialPortrait } from '@dugout/shared/player-portrait';
import { PlayerRelease } from './player-release';

type Props = {
  player: Player;
  game: GameState;
  busy: boolean;
  act: (action: Record<string, unknown>) => Promise<GameState | null>;
};
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
    <section className="profile-evidence dossier-card">
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
  const own =
    game.managerCareer?.status !== 'unemployed' && game.roster.some((p) => p.id === player.id);
  if (game.managerCareer?.status === 'unemployed')
    return (
      <section className="dossier-card">
        <h3>선수 계약 정보</h3>
        <dl className="dossier-facts">
          <div>
            <dt>연봉</dt>
            <dd>{money(player.salary)}</dd>
          </div>
          <div>
            <dt>잔여 계약</dt>
            <dd>{player.years}년</dd>
          </div>
        </dl>
      </section>
    );
  return (
    <>
      <PlayerContractRoom player={player} g={game} act={act} busy={busy} />
      {own && <OutgoingTransferPanel p={player} g={game} act={act} busy={busy} />}
      {own && <PlayerRelease player={player} g={game} act={act} busy={busy} />}
    </>
  );
}

export function PlayerProfile(props: Props) {
  const { player, game, act } = props;
  const busy =
    props.busy ||
    game.managerCareer?.status === 'unemployed' ||
    !!game.managerCareer?.vacationUntil;
  const { getClub } = useWorld();
  const profile = usePlayerProfile(player, game);
  const { own, tab, setTab } = profile;
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
            {playerPosition(player).label} · {player.ageEstimated ? '게임 나이 ' : ''}
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
          <span className="rating" title={ratingBasis(player)}>
            {ratingText(player)}
          </span>
          {own && <PlayerGrowth player={player} />}
        </div>
      </header>
      <div className="player-profile-ribbon">
        <Link href={countryPath(nationalCountry(player))}>
          {countryFlags[nationalCountry(player)] || '🌐'} {nationalCountry(player)}
        </Link>
        <span>{profile.ready}</span>
        {game.rules?.revealPotential && <span>잠재력 {potentialText(player)}</span>}
        <span>연봉 {money(player.salary)}</span>
        <span>잔여 계약 {player.years}년</span>
      </div>
      {player.internationalDuty && (
        <p className="international-player-note">
          {nationalCountry(player)} 대표팀 · {player.internationalDuty.name} 차출 중 ·{' '}
          {player.internationalDuty.returnDate} 구단 복귀 예정
        </p>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="profile-tabs" variant="line">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="profile">능력·역할</TabsTrigger>
          <TabsTrigger value="records">성적</TabsTrigger>
          {own && <TabsTrigger value="development">성장</TabsTrigger>}
          {!own && game.managerCareer?.status !== 'unemployed' && (
            <TabsTrigger value="scouting">관찰 · 관심 명단</TabsTrigger>
          )}
          <TabsTrigger value="contract">
            {game.managerCareer?.status === 'unemployed'
              ? '계약 정보'
              : own
                ? '계약·거래'
                : player.club === 'fa'
                  ? 'FA 계약'
                  : '트레이드'}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <PlayerOverview player={player} game={game} profile={profile} />
        </TabsContent>
        <TabsContent value="profile" className="player-detail-tab player-abilities-tab">
          <header className="detail-tab-heading">
            <div>
              <small>ATTRIBUTES & ROLE</small>
              <h3>능력과 선수단 역할</h3>
            </div>
            <p>확인된 평가와 현재 기용 계획을 살펴보세요.</p>
          </header>
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
          <section className="dossier-card">
            <header>
              <h2>세부 능력</h2>
              <span>{player.observation ? '스카우트 평가 범위' : '게임 내 능력'}</span>
            </header>
            <PlayerAttributes player={player} owned={own} />
          </section>
          {own && <PlayerRoleCard player={player} game={game} busy={busy} act={act} />}
          <details className="player-data-sources">
            <summary>평가 기준 · 데이터 출처</summary>
            <p className="profile-note">
              오버롤은 게임에서 사용하는 종합 능력입니다. * 표시는 자료가 부족한 생성 능력 또는
              표본이 적은 잠정 평가입니다. 확인된 실적 점수는 유지하고, 미확인 능력은 선수마다
              고정된 난수로 채웠습니다. 이후 훈련과 경기에 따른 성장·하락이 반영됩니다. 게임 생성
              수치는 실제 선수의 측정 기록이 아닙니다.
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
          </details>
        </TabsContent>
        <TabsContent value="records" className="player-detail-tab player-records-tab">
          <header className="detail-tab-heading">
            <div>
              <small>CAREER & STATISTICS</small>
              <h3>시즌 성적과 통산 기록</h3>
            </div>
            <p>게임에서 쌓은 성적과 공식 성적의 출처를 구분해 확인하세요.</p>
          </header>
          <CareerRecords playerId={player.id} current={player} year={game.year} />
          <PerformanceEvidence player={player} />
          <section className="profile-evidence dossier-card">
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
        <TabsContent value="contract" className="player-detail-tab player-contract-tab">
          <header className="detail-tab-heading">
            <div>
              <small>CONTRACT & TRANSACTIONS</small>
              <h3>{getClub(player.club)?.name || '자유계약'} · 선수 계약</h3>
            </div>
            <p>연봉과 잔여 계약, 현재 소속에 맞는 업무를 확인하세요.</p>
          </header>
          <ContractPanel {...props} busy={busy} />
        </TabsContent>
        {!own && (
          <TabsContent value="scouting" className="player-detail-tab">
            <ScoutPlayer player={player} g={game} act={act} busy={busy} />
          </TabsContent>
        )}
        {own && (
          <TabsContent value="development" className="player-detail-tab player-development-tab">
            <header className="detail-tab-heading">
              <div>
                <small>DEVELOPMENT</small>
                <h3>성장과 개인 훈련</h3>
              </div>
              <p>관찰한 변화에 맞춰 다음 훈련을 계획하세요.</p>
            </header>
            <PlayerRemodelPanel player={player} g={game} act={act} busy={busy} />
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
