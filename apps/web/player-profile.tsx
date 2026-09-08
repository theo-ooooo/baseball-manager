'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GameState, Player, Stats } from '../../packages/shared/src/types';
import { askPrice, fromManwon, money, toManwon } from '../../packages/shared/src/game-view';
import { potentialText, ratingText } from '../../packages/shared/src/ratings';
import { detailedAttributes, lineupReason } from '../../packages/shared/src/player-attributes';
import {
  defensivePositions,
  familiarity,
  transfersBlocked,
} from '../../packages/shared/src/management';
import { pitchingRole } from '../../packages/shared/src/pitching';
import { useWorld } from './world-context';
import { Mood, OutgoingTransferPanel } from './club-panels';
import { PositionTraining } from './management-panels';

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
    <p>
      {pitcher
        ? `${stats.g}경기 · ${innings(stats.outs)}이닝 · ${stats.wins}승 · ${stats.saves || 0}세이브 · ${stats.holds || 0}홀드 · ERA ${stats.outs ? ((stats.er * 27) / stats.outs).toFixed(2) : '—'}`
        : `${stats.g}경기 · ${stats.ab}타수 · ${stats.h}안타 · ${stats.hr}홈런 · ${stats.rbi}타점 · AVG ${stats.ab ? (stats.h / stats.ab).toFixed(3) : '—'}`}
    </p>
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
  const { agentFor } = useWorld();
  const agent = agentFor(player),
    own = game.roster.some((p) => p.id === player.id);
  const [salary, setSalary] = useState(String(toManwon(player.salary * 1.1)));
  const [years, setYears] = useState('3');
  const amount = fromManwon(Number(salary) || 0);
  const blocked = !own && transfersBlocked(game);
  const deal = game.deals.find((d) => d.player.id === player.id);
  async function negotiate() {
    const next = await act({
      type: 'negotiate',
      id: player.id,
      salary: amount,
      years: Number(years),
      renew: own,
    });
    if (next)
      toast(next.deals.find((d) => d.player.id === player.id)?.message || '제안을 보냈습니다.');
  }
  return (
    <section className="profile-contract">
      <div className="agent-contact">
        <div>
          <strong>
            {agent.name} <span className="gen-tag">가상 에이전트</span>
          </strong>
          <small>
            {agent.agency} · {agent.priority}
          </small>
        </div>
        <span className="pill">수수료 {(agent.fee * 100).toFixed(0)}%</span>
      </div>
      {blocked && <p className="rule-notice">첫 시즌 영입 금지 조건으로 협상할 수 없습니다.</p>}
      <div className="contract-inputs">
        <label>
          제안 연봉 (만 원)
          <input
            type="number"
            min="1"
            max="140000000"
            step="1"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
          <small>{money(amount)} / 시즌</small>
        </label>
        <label>
          계약 기간
          <Select value={years} onValueChange={setYears}>
            <SelectTrigger aria-label="계약 기간">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="contract-costs">
        <div>
          <span>예상 이적료 · 구단 판단 후 변동</span>
          <strong>{money(own ? 0 : askPrice(player))}</strong>
        </div>
        <div>
          <span>에이전트 수수료</span>
          <strong>{money(amount * agent.fee)}</strong>
        </div>
        <div>
          <span>계약금 · 첫해 연봉의 15%</span>
          <strong>{money(amount * 0.15)}</strong>
        </div>
        <div>
          <span>구단 예산</span>
          <strong>{money(game.budget)}</strong>
        </div>
      </div>
      <button
        className="button primary"
        disabled={busy || blocked || !Number.isFinite(amount) || amount <= 0}
        onClick={() => void negotiate()}
      >
        조건 제안하기
      </button>
      {deal && (
        <div className="rule-notice" role="status">
          <p>{deal.message}</p>
          <Link className="text-button" href="/?view=agents">
            협상 결과 · 최종 서명 →
          </Link>
        </div>
      )}
      {own && <OutgoingTransferPanel p={player} g={game} act={act} busy={busy} />}
    </section>
  );
}

export function PlayerProfile(props: Props) {
  const { player, game, act, busy } = props;
  const { getClub } = useWorld();
  const own = game.roster.some((p) => p.id === player.id);
  const slot = game.lineup.indexOf(player.id);
  const [tab, setTab] = useState('profile');
  return (
    <article className="panel player-page">
      <header className="profile-header">
        <span className={`profile-number ${player.real ? '' : 'generated'}`}>{player.number}</span>
        <div>
          <span className={player.real ? 'real-tag' : 'gen-tag'}>
            {player.real ? '실명 선수' : '가상 선수'}
          </span>
          <h2>{player.name}</h2>
          <p>
            {player.original !== player.name && `${player.original} · `}
            {positionNames[player.pos]} · {player.ageEstimated ? '게임 나이 ' : ''}
            {player.age}세 · {player.club === 'fa' ? 'FA · 자유계약' : getClub(player.club)?.name}
          </p>
        </div>
        <span className="rating">{ratingText(player)}</span>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="profile-tabs" variant="line">
          <TabsTrigger value="profile">프로필 · 세부 능력</TabsTrigger>
          <TabsTrigger value="records">성적 · 성장</TabsTrigger>
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
          <div className="attribute-grid">
            {detailedAttributes(player).map(({ label, value, basis }) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value ?? '미평가'}</strong>
                <Progress value={value ?? 0} aria-label={`${label} ${value ?? '미평가'}`} />
                <small>{basis}</small>
              </div>
            ))}
          </div>
          {own && (
            <section className="profile-development">
              <h3>선수단 역할</h3>
              <Mood p={player} />
              <p>{player.mood?.reason}</p>
              <p>
                {player.pos === 'P'
                  ? pitchingRole(game, player)
                  : slot >= 0
                    ? `${slot + 1}번 · ${lineupReason(player, slot)}`
                    : '벤치 · 타순 미등록'}
              </p>
              {player.pos === 'P' && (
                <Link className="text-button" href="/?view=tactics">
                  투수 보직 · 선발 변경 →
                </Link>
              )}
              <PositionTraining p={player} act={act} busy={busy} />
              <button
                className="button secondary compact"
                disabled={busy}
                onClick={() =>
                  void act({
                    type: 'squad',
                    id: player.id,
                    value: player.squad === 'reserve' ? 'first' : 'reserve',
                  })
                }
              >
                {player.squad === 'reserve' ? '1군 등록' : '2군 이동'}
              </button>
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
        </TabsContent>
        <TabsContent value="records">
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
      </Tabs>
    </article>
  );
}
