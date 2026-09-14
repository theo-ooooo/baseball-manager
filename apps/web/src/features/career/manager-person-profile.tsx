'use client';
import Link from 'next/link';
import { CoachOfferDialog } from '../squad/coach-negotiations';
import type { Act } from './game-contracts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GameState } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { abilityText } from '@dugout/shared/ratings';
import { managerAbilityLabels } from '@dugout/shared/manager-ability';
import { useManagerPersonProfile } from './use-manager-person-profile';
import { ManagerProfileHistory } from './manager-profile-history';
import { ManagerProfileAbilities } from './manager-profile-abilities';

export function ManagerPersonProfile({
  g,
  id,
  act,
  busy = false,
}: {
  g: GameState;
  id: string;
  act?: Act;
  busy?: boolean;
}) {
  const p = useManagerPersonProfile(g, id);
  if (!p.person)
    return (
      <section className="panel panel-content">
        <h1>감독 기록을 찾을 수 없습니다</h1>
        <p>통합 검색에서 감독 이름을 찾아 주세요.</p>
      </section>
    );
  const { person, contract, getClub } = p;
  const { job, self, club, record } = person;
  const target = contract?.targetRank ?? job?.expectation?.targetRank;
  const contractInfo = (
    <section className="dossier-card">
      <header>
        <h2>계약과 구단 기대</h2>
        <span>{club ? '재임 중' : '무직'}</span>
      </header>
      <dl className="dossier-facts">
        <div>
          <dt>소속</dt>
          <dd>
            {club ? <Link href={`/clubs/${club}`}>{getClub(club).name}</Link> : '소속 구단 없음'}
          </dd>
        </div>
        <div>
          <dt>시즌 목표</dt>
          <dd>{target ? `${target}위 이내` : '계약 없음'}</dd>
        </div>
        <div>
          <dt>연봉</dt>
          <dd>
            {contract
              ? money(contract.salary)
              : record?.role?.endsWith('코치') && p.coach
                ? money(p.coach.salary)
                : club
                  ? '비공개'
                  : '계약 없음'}
          </dd>
        </div>
        <div>
          <dt>계약 기간</dt>
          <dd>
            {contract
              ? `${contract.throughYear}시즌까지`
              : record?.role?.endsWith('코치') && p.coach?.contractUntil
                ? `${p.coach.contractUntil - 1}시즌까지`
                : club
                  ? '비공개'
                  : '계약 없음'}
          </dd>
        </div>
        {contract && (
          <div>
            <dt>계약금 · 체결 시 1회</dt>
            <dd>{money(contract.signingBonus || 0)}</dd>
          </div>
        )}
        {self && (
          <div>
            <dt>통산 수령 급여·계약금</dt>
            <dd>{money(g.managerCareer?.earnings || 0)}</dd>
          </div>
        )}
      </dl>
      {self && (
        <Link className="button secondary" href="/?view=manager-contract">
          계약 · 휴가 관리 →
        </Link>
      )}
    </section>
  );
  return (
    <article className="manager-dossier">
      <header className="manager-profile-hero">
        <div className="manager-profile-identity">
          <span className="manager-profile-monogram" aria-hidden="true">
            {person.name.slice(0, 1)}
          </span>
          <div>
            <span className="manager-profile-kicker">
              {self ? '내 감독' : record?.real ? '실명 지도자' : '가상 지도자'} ·{' '}
              {record?.role || '감독'}
            </span>
            <h1>{person.name}</h1>
            <p>
              {club ? (
                <Link href={`/clubs/${club}`}>{getClub(club).name} ↗</Link>
              ) : (
                '무직 · 다음 구단을 기다리는 중'
              )}
            </p>
            {p.strongest && (
              <span className="manager-style-tag">{managerAbilityLabels[p.strongest]} 중심</span>
            )}
          </div>
        </div>
        <dl className="manager-profile-scoreboard">
          <div>
            <dt>이번 시즌 취임 후</dt>
            <dd>
              {job ? `${p.wins}승 ${p.losses}패` : '—'}
              <small>
                {job
                  ? `${p.draws}무 · 승률 ${p.winRate ? `${p.winRate}%` : '—'}`
                  : '현재 재임 기록 없음'}
              </small>
            </dd>
          </div>
          <div>
            <dt>지도 능력</dt>
            <dd>
              {abilityText(p.abilityOverall)}
              <small>종합 / 100</small>
            </dd>
          </div>
          <div>
            <dt>평판</dt>
            <dd>
              {abilityText(p.reputation)}
              <small>구단의 채용 평가</small>
            </dd>
          </div>
        </dl>
      </header>
      <div className="manager-profile-intro">
        <p>
          {p.background?.summary ||
            (record?.real
              ? '현역 지도자의 공개 이력과 이 커리어에서의 행보를 확인하세요.'
              : '첫 부임부터 다음 도전까지, 감독의 경력을 기록합니다.')}
        </p>
        <div className="manager-profile-actions">
          {self ? (
            <>
              <Link className="button secondary" href="/manager/offers">
                받은 제안
              </Link>
              <Link className="button secondary" href="/?view=jobs">
                채용 센터
              </Link>
            </>
          ) : (
            p.coach &&
            record &&
            !record.club &&
            act &&
            g.managerCareer?.status !== 'unemployed' && (
              <button
                className="button primary"
                disabled={busy || !!g.managerCareer?.vacationUntil}
                onClick={() => p.setOffering(true)}
              >
                코치직 제안
              </button>
            )
          )}
        </div>
      </div>
      <Tabs value={p.tab} onValueChange={p.setTab}>
        <TabsList className="dossier-tabs" variant="line">
          <TabsTrigger value="overview">프로필</TabsTrigger>
          <TabsTrigger value="history">경력 · 히스토리</TabsTrigger>
          <TabsTrigger value="contract">계약 · 구단 기대</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="manager-profile-layout">
            <div className="manager-profile-main">
              {p.ability && <ManagerProfileAbilities ability={p.ability} self={self} />}
              <ManagerProfileHistory profile={p} compact />
            </div>
            <aside className="manager-profile-aside">
              <section className="dossier-card">
                <header>
                  <h2>구단의 평가</h2>
                  <span>{g.year} 시즌</span>
                </header>
                <div className="manager-evaluation">
                  {job ? (
                    <div>
                      <span>
                        이사회 신뢰<strong>{abilityText(job.confidence)} / 100</strong>
                      </span>
                      <progress max={100} value={job.confidence} aria-label="이사회 신뢰" />
                      <p>{job.reason}</p>
                    </div>
                  ) : (
                    <p>{club ? '코치로 재직 중입니다.' : '현재 소속 구단이 없습니다.'}</p>
                  )}
                  <dl className="dossier-facts">
                    <div>
                      <dt>리그 순위</dt>
                      <dd>{p.rank ? `${p.rank}위` : '—'}</dd>
                    </div>
                    <div>
                      <dt>시즌 목표</dt>
                      <dd>{target ? `${target}위 이내` : '—'}</dd>
                    </div>
                  </dl>
                </div>
              </section>
              {contractInfo}
              {record?.personality && (
                <section className="dossier-card">
                  <header>
                    <h2>보직 · 협상 성향</h2>
                  </header>
                  <p className="manager-background-summary">{p.stance?.reason}</p>
                  <dl className="dossier-facts">
                    {[
                      ['감독직 선호', record.personality.managerPreference],
                      ['보직 유연성', record.personality.flexibility],
                      ['연봉 중시', record.personality.money],
                      ['고집', record.personality.stubbornness],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value} / 100</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="person-profile-note">
                    게임 내 성향이며 실제 인물의 성격을 뜻하지 않습니다.
                  </p>
                </section>
              )}
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <ManagerProfileHistory profile={p} />
        </TabsContent>
        <TabsContent value="contract">{contractInfo}</TabsContent>
      </Tabs>
      {p.offering && p.coach && act && (
        <CoachOfferDialog
          coach={p.coach}
          role={p.coach.role}
          g={g}
          act={act}
          busy={busy}
          close={() => p.setOffering(false)}
        />
      )}
    </article>
  );
}
