'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { isUnemployed } from '@dugout/shared/manager-career';
import { gameDate } from '@dugout/shared/calendar';
import { money } from '@dugout/shared/game-view';
import { useWorld } from './world-context';
import type { Act } from './game-contracts';
import { Choice, Metric } from '../../components/game-ui';

export function ManagerPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { clubs, getClub, standings } = useWorld();
  const m = g.managerCareer,
    unemployed = isUnemployed(g);
  const [target, setTarget] = useState(m?.contract?.targetRank || 1),
    [days, setDays] = useState(7),
    [resign, setResign] = useState(false);
  const selected = g.club;
  const max = Math.ceil(clubs.filter((c) => c.league === getClub(selected).league).length * 0.75);
  const canTarget =
    !unemployed && !m?.vacationUntil && (g.day < 0 || m?.contract?.signed === gameDate(g));
  return (
    <div className="manager-office">
      <div className="metrics">
        <Metric
          label="감독 상태"
          value={unemployed ? '무직 · 구직 중' : m?.vacationUntil ? '휴가 중' : '재직 중'}
          sub={unemployed ? `${m?.unemployedSince}부터` : getClub(g.club).name}
        />
        <Metric
          label="감독 연봉"
          value={money(m?.contract?.salary || 0)}
          sub={m?.contract ? `${m.contract.throughYear}시즌까지 계약` : '현재 급여 없음'}
        />
        <Metric label="감독 평판" value={m?.reputation ?? g.reputation} sub="채용 심사에 반영" />
        <Metric label="누적 수령 급여" value={money(m?.earnings || 0)} sub="감독 개인 경력 기록" />
      </div>
      <section className="panel panel-content">
        <h2>{unemployed ? '감독 채용 · 구단에 지원' : '구단주와 시즌 목표'}</h2>
        {unemployed ? (
          <>
            <p>
              같은 세계에서 날짜와 리그 순위가 계속 진행됩니다. 최대 세 구단에 지원할 수 있고 3일 뒤
              답변을 받습니다. 제안에 서명하면 해당 구단의 기존 선수단과 순위를 이어갑니다.
            </p>
            <Link className="button primary" href="/?view=jobs">
              감독 채용 현황 · 지원 가능한 팀 찾기
            </Link>
          </>
        ) : (
          <p>
            구단주 신임도 {g.managerJobs?.[g.club]?.confidence ?? 65}% · 현재{' '}
            {standings(g).findIndex((s) => s.club === g.club) + 1}위 · 합의 목표{' '}
            {m?.contract?.targetRank}위 이내. 정규시즌 최종 순위로 평가하며, 달성하면 연봉 15%
            인상과 계약 연장, 미달하면 해고됩니다.
          </p>
        )}
        {!unemployed && (
          <div className="manager-form">
            <Choice
              label="희망 순위 목표"
              value={String(Math.min(target, max))}
              onChange={(v) => setTarget(Number(v))}
              items={Array.from({ length: max }, (_, i) => ({
                value: String(i + 1),
                label: `${i + 1}위 이내`,
              }))}
            />
            <button
              className="button primary"
              disabled={busy || (!unemployed && !canTarget)}
              onClick={() => void act({ type: 'managerTarget', targetRank: Math.min(target, max) })}
            >
              목표·연봉 합의
            </button>
          </div>
        )}
        <p className="muted">
          목표를 높이면 제시 연봉도 올라갑니다. 재직 중 목표는 개막 전 또는 취임 당일에 협의합니다.
          포스트시즌 중에는 채용 답변을 받아도 포스트시즌 종료 후 취임합니다.
        </p>
      </section>
      {!!m?.offers.length && (
        <section className="panel panel-content">
          <h2>지원 현황 · 계약 제안</h2>
          {m.offers.map((o) => (
            <article className="manager-offer" key={o.id}>
              <h3>
                {getClub(o.club).name} ·{' '}
                {
                  {
                    pending: '검토 중',
                    offered: '계약 제안',
                    rejected: '거절',
                    expired: '제안 만료',
                  }[o.status]
                }
              </h3>
              <p>{o.message}</p>
              <p>
                {o.targetRank}위 이내 · 연봉 {money(o.salary)} · 답변 {o.due} · 제안 유효{' '}
                {o.expires}
              </p>
              {o.status === 'offered' && (
                <button
                  className="button primary"
                  disabled={busy || ['semifinal', 'final'].includes(g.phase)}
                  onClick={() => void act({ type: 'signManager', id: o.id })}
                >
                  {g.manager} 감독 서명 · 계약 후 취임
                </button>
              )}
            </article>
          ))}
        </section>
      )}
      <section className="panel panel-content">
        <h2>
          {unemployed
            ? '구직 기간 진행'
            : g.phase === 'finished'
              ? '시즌 종료 후 일정'
              : '휴가 · 감독직 사퇴'}
        </h2>
        {unemployed ? (
          <p>
            지원 결과를 기다리며 날짜를 진행하세요. 소속 팀의 경기 지휘와 계약 업무는 새 감독 계약
            후 이용할 수 있습니다.
          </p>
        ) : m?.vacationUntil ? (
          <p>
            {m.vacationUntil} 복귀 예정 · 코치가 기존 타순과 전술로 경기를 지휘합니다. 선수 면담은
            운용 방침 설명으로 처리합니다.
          </p>
        ) : (
          <>
            <p>휴가 중에는 코치에게 경기를 위임합니다. 목표 평가와 급여 지급은 계속됩니다.</p>
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
        {g.phase === 'finished' && (
          <p>
            현재 구단의 시즌이 끝났습니다. 날짜를 보내면 다른 리그의 남은 경기가 계속됩니다. 시즌
            종료 후 취임한 감독은 다음 시즌부터 목표 평가를 받습니다.
          </p>
        )}
        {(unemployed || m?.vacationUntil || g.phase === 'finished') && (
          <div className="manager-form">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void act({ type: 'managerContinue', count: 7 })}
            >
              {unemployed
                ? '최대 7일 · 지원 답변 기다리기'
                : m?.vacationUntil
                  ? '최대 7일 · 휴가 진행'
                  : '최대 7일 · 날짜 진행'}
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
            {m?.vacationUntil && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void act({ type: 'endVacation' })}
              >
                지금 복귀
              </button>
            )}
          </div>
        )}
        {!unemployed && (
          <div className="manager-resign">
            {resign ? (
              <>
                <p>
                  사퇴하면 구단 운영 권한과 감독 급여가 종료됩니다. 이 커리어에서 다시 구직할 수
                  있습니다.
                </p>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    if (await act({ type: 'resignManager', confirm: true })) setResign(false);
                  }}
                >
                  사퇴 확정
                </button>{' '}
                <button className="button secondary" onClick={() => setResign(false)}>
                  돌아가기
                </button>
              </>
            ) : (
              <button
                className="text-button"
                disabled={busy || !!g.liveMatch}
                onClick={() => setResign(true)}
              >
                감독직 사퇴하기
              </button>
            )}
          </div>
        )}
      </section>
      <section className="panel panel-content">
        <h2>감독 경력</h2>
        {m?.history.length ? (
          m.history.map((h, i) => (
            <p key={`${h.from}-${i}`}>
              <strong>{getClub(h.club).name}</strong> · {h.from} ~ {h.to} ·{' '}
              {h.reason === 'resigned' ? '사퇴' : '해고'} · 퇴임 당시 {h.rank}위
            </p>
          ))
        ) : (
          <p>아직 퇴임한 구단이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
