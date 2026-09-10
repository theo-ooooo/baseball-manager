'use client';
import Link from 'next/link';
import { departureLabel, departureDetail } from '@dugout/shared/manager-departure';
import { ManagerInterviewSession } from './manager-interview-session';
import { ManagerOfferCard } from './manager-offer-card';
import { ClubVision } from './club-vision';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { isUnemployed } from '@dugout/shared/manager-career';
import { money } from '@dugout/shared/game-view';
import { useWorld } from './world-context';
import type { Act } from './game-contracts';
import { Choice, Metric } from '../../components/game-ui';
export function ManagerPanel({
  g,
  act,
  busy,
  mode = 'profile',
  offerId,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  mode?: 'profile' | 'contract' | 'history' | 'vision' | 'offers';
  offerId?: string;
}) {
  const { getClub } = useWorld(),
    m = g.managerCareer,
    unemployed = isUnemployed(g);
  const [days, setDays] = useState(7),
    [resign, setResign] = useState(false);
  const active =
    m?.offers.filter((o) => ['invited', 'pending', 'interview', 'offered'].includes(o.status)) ||
    [];
  return (
    <div className="manager-office">
      {mode !== 'vision' && !offerId && (
        <nav className="section-tabs" aria-label="홈과 감독 프로필">
          {[
            ['home', '홈'],
            ['manager', '내 프로필'],
            ['manager-contract', '계약 · 휴가'],
            ['manager-history', '경력'],
            ['job-offers', '받은 제안'],
          ].map(([id, label]) => (
            <Link
              key={id}
              href={id === 'job-offers' ? '/manager/offers' : `/?view=${id}`}
              aria-current={
                id ===
                (mode === 'profile'
                  ? 'manager'
                  : mode === 'offers'
                    ? 'job-offers'
                    : `manager-${mode}`)
                  ? 'page'
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {mode === 'profile' && (
        <>
          <section className="panel panel-content">
            <h2>{g.manager}</h2>
            <p>{unemployed ? '소속 없음 · 구직 중' : `${getClub(g.club).name} 감독`}</p>
            <div className="metrics">
              <Metric label="평판" value={m?.reputation ?? g.reputation} sub="채용 심사에 반영" />
              <Metric
                label="감독 연봉"
                value={money(m?.contract?.salary || 0)}
                sub={m?.contract ? `${m.contract.throughYear}시즌까지` : '급여 없음'}
              />
              <Metric label="통산 수령 급여" value={money(m?.earnings || 0)} sub="감독 개인 경력" />
            </div>
            <p>
              {m?.vacationUntil
                ? `${m.vacationUntil}까지 휴가 중`
                : unemployed
                  ? `${m?.unemployedSince}부터 새 구단을 찾고 있습니다.`
                  : `${m?.contract?.signed} 취임 · 구단주 신임도 ${g.managerJobs?.[g.club]?.confidence ?? 65}%`}
            </p>
            <div className="manager-form">
              <Link className="button secondary" href="/?view=manager-contract">
                계약 · 휴가 · 사퇴
              </Link>
              {!unemployed && (
                <Link className="button secondary" href="/?view=vision">
                  구단 비전
                </Link>
              )}
              <Link className="button primary" href="/?view=jobs">
                채용 센터
              </Link>
            </div>
          </section>
          {!!active.length && (
            <section className="panel panel-content">
              <h2>진행 중인 채용 {active.length}건</h2>
              <p>{active.map((o) => getClub(o.club).name).join(' · ')}</p>
              <Link className="button primary" href="/manager/offers">
                면접 · 계약 제안 확인
              </Link>
            </section>
          )}
        </>
      )}
      {mode === 'vision' && !unemployed && <ClubVision g={g} act={act} busy={busy} />}
      {mode === 'offers' && !offerId && (
        <>
          <header className="offers-page-heading">
            <span>MANAGER · OPPORTUNITIES</span>
            <h2>받은 면접 · 계약 제안</h2>
            <p>나에게 도착한 구단의 연락입니다. 제안을 열어 면접과 계약 협상을 이어가세요.</p>
          </header>
          {!m?.offers.length && (
            <section className="panel panel-content">
              <p>
                아직 도착한 연락이 없습니다. 날짜를 진행하며 구단의 제의를 기다리거나 채용 센터에서
                관심을 전해 보세요.
              </p>
              <Link href="/?view=jobs" className="button secondary">
                채용 센터
              </Link>
            </section>
          )}
          <div className="manager-offers-grid">
            {m?.offers.map((o) => (
              <ManagerOfferCard key={o.id} offer={o} g={g} act={act} busy={busy} summary />
            ))}
          </div>
        </>
      )}
      {mode === 'offers' &&
        offerId &&
        (m?.offers.find((o) => o.id === offerId) ? (
          <ManagerInterviewSession
            g={g}
            offer={m.offers.find((o) => o.id === offerId)!}
            act={act}
            busy={busy}
          />
        ) : (
          <section className="panel panel-content">
            <h2>이 채용 절차는 종료됐습니다.</h2>
            <Link href="/manager/offers">받은 제안으로 돌아가기</Link>
          </section>
        ))}
      {mode === 'contract' && (
        <section className="panel panel-content">
          <h2>{unemployed ? '구직 기간' : '감독 계약'}</h2>
          <p>
            {m?.contract
              ? `${getClub(g.club).name} · ${m.contract.signed} 계약 · ${m.contract.throughYear}시즌까지 · 연봉 ${money(m.contract.salary)}`
              : '현재 계약과 감독 급여가 없습니다.'}
          </p>
          {!unemployed && !m?.vacationUntil && (
            <>
              <h3>휴가</h3>
              <p>경기는 코치에게 위임하며 구단주 평가는 계속됩니다.</p>
              <div className="manager-form">
                <Choice
                  label="휴가 기간"
                  value={String(days)}
                  onChange={(v) => setDays(Number(v))}
                  items={[1, 7, 14, 28].map((d) => ({ value: String(d), label: `${d}일` }))}
                />
                <button
                  className="button secondary"
                  disabled={busy || !!g.liveMatch || g.phase === 'finished'}
                  onClick={() => void act({ type: 'startVacation', days })}
                >
                  휴가 떠나기
                </button>
              </div>
            </>
          )}
          {m?.vacationUntil && (
            <p>
              {m.vacationUntil} 복귀 예정{' '}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void act({ type: 'endVacation' })}
              >
                지금 복귀
              </button>
            </p>
          )}
          {(unemployed || m?.vacationUntil || g.phase === 'finished') && (
            <div className="manager-form">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void act({ type: 'managerContinue', count: 7 })}
              >
                최대 7일 진행 · 채용 답변 시 정지
              </button>
              {g.phase === 'finished' && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void act({ type: 'nextSeason' })}
                >
                  다음 시즌 시작
                </button>
              )}
            </div>
          )}
          {!unemployed && (
            <details className="manager-resign">
              <summary>계약 종료 · 사퇴</summary>
              <p>소속과 급여가 종료되며, 같은 커리어에서 계속 구직할 수 있습니다.</p>
              <label>
                <input
                  type="checkbox"
                  checked={resign}
                  onChange={(e) => setResign(e.target.checked)}
                />{' '}
                감독직 사퇴 확인
              </label>
              <button
                className="button secondary"
                disabled={busy || !!g.liveMatch || !resign}
                onClick={async () => {
                  if (await act({ type: 'resignManager', confirm: true })) setResign(false);
                }}
              >
                사퇴 확정
              </button>
            </details>
          )}
        </section>
      )}
      {mode === 'history' && (
        <section className="panel panel-content">
          <h2>감독 경력</h2>
          {m?.contract && (
            <p>
              <strong>{getClub(g.club).name}</strong> · {m.contract.signed} ~ 현재
            </p>
          )}
          {m?.history.map((h, i) => (
            <p key={`${h.from}-${i}`}>
              <strong>{getClub(h.club).name}</strong> · {h.from} ~ {h.to} · {departureLabel(h)} ·
              퇴임 당시 {h.rank}위
              <br />
              {departureDetail(g, h)}
            </p>
          ))}
          {!m?.history.length && !m?.contract && <p>아직 맡은 구단이 없습니다.</p>}
        </section>
      )}
    </div>
  );
}
