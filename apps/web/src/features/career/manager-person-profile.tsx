'use client';
import Link from 'next/link';
import { CoachOfferDialog } from '../squad/coach-negotiations';
import type { Act } from './game-contracts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GameState } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { abilityText } from '@dugout/shared/ratings';
import { departureLabel } from '@dugout/shared/manager-departure';
import { useManagerPersonProfile } from './use-manager-person-profile';
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
  const { person, contract, getClub } = p,
    { job, self, club, record } = person;
  const target = contract?.targetRank ?? job?.expectation?.targetRank;
  const history = (
    <section className="dossier-card">
      <header>
        <h2>감독 경력</h2>
        <span>현재 커리어에 남은 기록</span>
      </header>
      <div className="manager-career-timeline">
        {self && club && (
          <div>
            <span className="dossier-badge">재임 중</span>
            <h3>
              <Link href={`/clubs/${club}`}>{getClub(club).name}</Link>
            </h3>
            <p>{job?.appointed} ~ 현재</p>
          </div>
        )}
        {self &&
          g.managerCareer?.history.map((h, i) => (
            <div key={`${h.from}:${i}`}>
              <span>{departureLabel(h)}</span>
              <h3>
                <Link href={`/clubs/${h.club}`}>{getClub(h.club).name}</Link>
              </h3>
              <p>
                {h.from} ~ {h.to} · 퇴임 {h.rank}위
              </p>
            </div>
          ))}
        {record?.career.map((h, i) => (
          <div key={`${h.club}:${i}`}>
            <span className={h.active ? 'dossier-badge' : undefined}>
              {h.role || '감독'} · {h.active ? '재임 중' : '이전 소속'}
            </span>
            <h3>
              <Link href={`/clubs/${h.club}`}>{getClub(h.club).name}</Link>
            </h3>
            <p>
              {h.from
                ? `${h.from} ~ ${h.active ? '현재' : h.to || '퇴임일 미기록'}`
                : '재임 날짜 기록 없음'}
            </p>
            {h.wins !== undefined && (
              <p>
                {h.wins}승 {h.losses || 0}패 · 기록된 재임 성적
              </p>
            )}
            {h.reason && <small>{h.reason}</small>}
          </div>
        ))}
        {self && !club && !g.managerCareer?.history.length && (
          <p>아직 구단을 맡은 경력이 없습니다.</p>
        )}
      </div>
    </section>
  );
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
      <header className="country-dossier-header manager-dossier-header">
        <div className="country-identity">
          <span className="person-monogram" aria-hidden="true">
            감독
          </span>
          <div>
            <span className="country-kicker">
              {self ? '내 감독 프로필' : record?.real ? '실명 지도자' : '가상 지도자'}
            </span>
            <h1>{person.name}</h1>
            <p>
              {club ? (
                <Link href={`/clubs/${club}`}>
                  {getClub(club).name} · {record?.role || '감독'}
                </Link>
              ) : (
                '무직 · 새 구단 취임 가능'
              )}
            </p>
          </div>
        </div>
        <dl className="country-headline-stats">
          <div>
            <dt>평판</dt>
            <dd>
              {abilityText(p.reputation)}
              <small>/ 100</small>
            </dd>
          </div>
          <div>
            <dt>이사회 신뢰</dt>
            <dd>
              {job ? abilityText(job.confidence) : '—'}
              <small>{job ? '/ 100' : club ? '코치 재직' : '소속 없음'}</small>
            </dd>
          </div>
          <div>
            <dt>리그 순위</dt>
            <dd>
              {p.rank || '—'}
              <small>{p.rank ? '위' : club ? '경기 전' : '무직'}</small>
            </dd>
          </div>
        </dl>
      </header>
      <Tabs value={p.tab} onValueChange={p.setTab}>
        <TabsList className="dossier-tabs" variant="line">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="contract">계약 · 구단 기대</TabsTrigger>
          <TabsTrigger value="history">경력</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="manager-overview-grid">
            <section className="dossier-card">
              <header>
                <h2>감독 평가</h2>
                <span>{g.year} 시즌</span>
              </header>
              <div className="manager-evaluation">
                {p.reputation !== undefined && (
                  <div>
                    <span>
                      평판<strong>{abilityText(p.reputation)} / 100</strong>
                    </span>
                    <progress max={100} value={p.reputation} aria-label="감독 평판" />
                    <p>구단의 채용 심사와 감독 영입 제안에 반영됩니다.</p>
                  </div>
                )}
                {job ? (
                  <div>
                    <span>
                      이사회 신뢰<strong>{abilityText(job.confidence)} / 100</strong>
                    </span>
                    <progress max={100} value={job.confidence} aria-label="이사회 신뢰" />
                    <p>{job.reason}</p>
                  </div>
                ) : (
                  <p>현재 소속 구단이 없어 이사회 평가와 시즌 목표가 없습니다.</p>
                )}
                {job && (
                  <dl className="dossier-facts">
                    <div>
                      <dt>이번 시즌 취임 후</dt>
                      <dd>
                        {p.wins}승 {p.losses}패
                      </dd>
                    </div>
                    <div>
                      <dt>선두로 마친 경기</dt>
                      <dd>{job.board?.leaderGames || 0}경기</dd>
                    </div>
                  </dl>
                )}
              </div>
              {record?.personality && (
                <div className="manager-personality">
                  <h3>보직 · 협상 성향</h3>
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
                  <p>{p.stance?.reason}</p>
                  <small>실제 인물의 성격과 별개인 게임 내 성향입니다.</small>
                </div>
              )}
              {p.coach &&
                record &&
                !record.club &&
                act &&
                g.managerCareer?.status !== 'unemployed' && (
                  <div className="manager-profile-actions">
                    <button
                      className="button primary"
                      disabled={busy || !!g.managerCareer?.vacationUntil}
                      onClick={() => p.setOffering(true)}
                    >
                      코치직 제안
                    </button>
                    <Link className="button secondary" href="/?view=staff">
                      코치 협상 현황
                    </Link>
                  </div>
                )}
              <p className="person-profile-note">
                게임 내 평판과 재임 성과입니다. 훈련 지도 능력은 담당 코치의 능력치를 따릅니다.
              </p>
            </section>
            {contractInfo}
            {history}
            {self && (
              <section className="dossier-card">
                <header>
                  <h2>다음 커리어</h2>
                </header>
                <p>면접 제안과 구단이 제시한 계약 조건을 확인하세요.</p>
                <div className="manager-profile-actions">
                  <Link className="button primary" href="/manager/offers">
                    받은 제안
                  </Link>
                  <Link className="button secondary" href="/?view=jobs">
                    채용 센터
                  </Link>
                  {club && (
                    <Link className="button secondary" href="/?view=vision">
                      구단 비전
                    </Link>
                  )}
                </div>
              </section>
            )}
          </div>
        </TabsContent>
        <TabsContent value="contract">{contractInfo}</TabsContent>
        <TabsContent value="history">{history}</TabsContent>
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
