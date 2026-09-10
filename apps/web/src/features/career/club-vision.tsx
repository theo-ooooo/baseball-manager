'use client';
import { useState } from 'react';
import { MessageSquare, Flag, ShieldCheck, Wallet, Sprout } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState } from '@dugout/shared/types';
import { boardObjectiveLabels, boardProgress } from '@dugout/shared/manager-career';
import { gameDate } from '@dugout/shared/calendar';
import { money } from '@dugout/shared/game-view';
import { useWorld } from './world-context';
import { Choice } from '../../components/game-ui';
import type { Act } from './game-contracts';
export function ClubVision({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { clubs, getClub, standings } = useWorld(),
    club = getClub(g.club),
    contract = g.managerCareer!.contract!;
  const [tab, setTab] = useState<'overview' | 'requests'>('overview'),
    [meeting, setMeeting] = useState<'target' | 'support' | null>(null),
    [target, setTarget] = useState(contract.targetRank),
    [objective, setObjective] = useState('youth'),
    [benefit, setBenefit] = useState('training');
  const row = standings(g).find((s) => s.club === g.club)!,
    rank = standings(g).findIndex((s) => s.club === g.club) + 1,
    played = row.w + row.l + row.d;
  const confidence = g.managerJobs?.[g.club]?.confidence ?? 65,
    grade =
      confidence >= 90
        ? 'A+'
        : confidence >= 80
          ? 'A'
          : confidence >= 70
            ? 'B+'
            : confidence >= 60
              ? 'B'
              : confidence >= 45
                ? 'C'
                : confidence >= 30
                  ? 'D'
                  : 'F';
  const max = Math.ceil(clubs.filter((c) => c.league === club.league).length * 0.75),
    canNegotiate =
      !g.liveMatch &&
      !g.managerCareer?.vacationUntil &&
      (g.day < 0 || contract.signed === gameDate(g));
  const progress = contract.objective ? boardProgress(g, contract.objective) : 0,
    profit = g.income - g.expenses;
  const expectation =
    played === 0 ? '평가 대기' : rank <= contract.targetRank ? '기대 충족' : '개선 필요';
  const feedback =
    played === 0
      ? '새 시즌의 출발을 기대하고 있습니다. 합의한 목표를 향해 선수단을 준비해 주십시오.'
      : confidence >= 60
        ? '감독의 운영 방향을 지지합니다. 합의한 시즌 목표를 향해 집중해 주십시오.'
        : '최근 성적과 운영 방향에 우려가 있습니다. 이사회에 약속한 목표를 달성할 수 있도록 개선이 필요합니다.';
  return (
    <div className="club-vision">
      <nav className="vision-tabs" aria-label="구단 비전">
        <button aria-pressed={tab === 'overview'} onClick={() => setTab('overview')}>
          개요 · 이사회 평가
        </button>
        <button aria-pressed={tab === 'requests'} onClick={() => setTab('requests')}>
          이사회 요청
        </button>
      </nav>
      {tab === 'overview' ? (
        <>
          <section className="vision-board panel">
            <div className={`vision-grade ${confidence < 45 ? 'concern' : ''}`}>
              <small>종합 평가</small>
              <strong>{grade}</strong>
              <span>
                {played === 0
                  ? '취임 시 평가'
                  : confidence >= 60
                    ? '신뢰'
                    : confidence >= 35
                      ? '검토 중'
                      : '우려'}
              </span>
            </div>
            <div>
              <span className="vision-eyebrow">{club.name} 이사회</span>
              <h2>{g.manager} 감독에 대한 평가</h2>
              <p>{feedback}</p>
              <span className="vision-contract">
                계약 기간 · {contract.throughYear}시즌까지 / 연봉 {money(contract.salary)}
              </span>
            </div>
            <button className="button secondary" onClick={() => setTab('requests')}>
              <MessageSquare size={15} />
              이사회와 대화
            </button>
          </section>
          <div className="vision-columns">
            <div>
              <section className="panel vision-section">
                <header>
                  <Flag size={18} />
                  <h2>시즌 계획</h2>
                  <span>{g.year}</span>
                </header>
                <div className="vision-plan-year">
                  <strong>이번 시즌 종료까지</strong>
                  <span>목표의 중요도 · 필수</span>
                </div>
                <div className="vision-objective">
                  <div>
                    <strong>
                      {club.league.toUpperCase()} · {contract.targetRank}위 이내 달성
                    </strong>
                    <small>
                      {played
                        ? `현재 ${rank}위 · ${played}경기`
                        : '정규시즌 개막 후 성적을 평가합니다.'}
                    </small>
                  </div>
                  <b
                    className={`vision-status ${played && rank > contract.targetRank ? 'concern' : ''}`}
                  >
                    {expectation}
                  </b>
                </div>
                {contract.objective && (
                  <div className="vision-objective">
                    <div>
                      <strong>{boardObjectiveLabels[contract.objective.kind]}</strong>
                      <small>
                        현재{' '}
                        {contract.objective.kind === 'profit'
                          ? money(progress)
                          : `${progress.toFixed(1)}%`}{' '}
                        / 목표{' '}
                        {contract.objective.kind === 'profit'
                          ? money(contract.objective.target)
                          : `${contract.objective.target}%`}
                      </small>
                      <progress
                        aria-label="운영 약속 달성도"
                        max={100}
                        value={Math.min(
                          100,
                          Math.max(0, (progress / contract.objective.target) * 100),
                        )}
                      />
                    </div>
                    <b
                      className={`vision-status ${progress < contract.objective.target ? 'concern' : ''}`}
                    >
                      {progress >= contract.objective.target ? '목표 충족' : '진행 중'}
                    </b>
                  </div>
                )}
                <div className="vision-plan-year">
                  <strong>다음 계약 검토</strong>
                  <span>{contract.throughYear}시즌 종료</span>
                </div>
                <div className="vision-objective">
                  <div>
                    <strong>합의한 목표 달성 시 재계약 검토</strong>
                    <small>순위와 운영 약속 달성 시 1시즌 연장 · 연봉 15% 인상</small>
                  </div>
                  <span className="muted">예정</span>
                </div>
                <p className="vision-footnote">
                  목표 미달 또는 심각한 신임도 하락은 감독직 상실로 이어질 수 있습니다. 이후 시즌
                  목표는 재계약 때 확인합니다.
                </p>
              </section>
              <section className="panel vision-section">
                <header>
                  <Sprout size={18} />
                  <h2>구단 운영 방향</h2>
                </header>
                <div className="vision-objective">
                  <div>
                    <strong>
                      {contract.objective
                        ? boardObjectiveLabels[contract.objective.kind]
                        : '현재 합의된 추가 운영 약속 없음'}
                    </strong>
                    <small>
                      {contract.objective
                        ? '이사회 지원을 받는 조건으로 약속한 운영 목표입니다.'
                        : '이사회와 협의해 육성, 연봉 관리, 수익 목표를 추가할 수 있습니다.'}
                    </small>
                  </div>
                  <span className="vision-priority">
                    {contract.objective ? '필수' : '협의 가능'}
                  </span>
                </div>
              </section>
            </div>
            <aside>
              <section className="panel vision-section">
                <header>
                  <ShieldCheck size={18} />
                  <h2>평가 항목</h2>
                </header>
                <dl className="vision-facts">
                  <div>
                    <dt>시즌 성적</dt>
                    <dd>{expectation}</dd>
                  </div>
                  <div>
                    <dt>운영 약속</dt>
                    <dd>
                      {contract.objective
                        ? progress >= contract.objective.target
                          ? '목표 충족'
                          : '진행 중'
                        : '추가 약속 없음'}
                    </dd>
                  </div>
                  <div>
                    <dt>현재 보유 예산</dt>
                    <dd>{money(g.budget)}</dd>
                  </div>
                  <div>
                    <dt>시즌 운영 손익</dt>
                    <dd>{money(profit)}</dd>
                  </div>
                  <div>
                    <dt>훈련시설</dt>
                    <dd>{g.facilities?.training || 1} / 5단계</dd>
                  </div>
                </dl>
              </section>
              <section className="panel vision-section">
                <header>
                  <Wallet size={18} />
                  <h2>이사회가 제공한 지원</h2>
                </header>
                <p>
                  {contract.negotiatedYear === g.year
                    ? contract.benefit === 'training'
                      ? '훈련시설 개선을 완료했습니다.'
                      : '추가 운영 자금을 지급했습니다.'
                    : '이번 시즌 추가 지원을 요청하지 않았습니다.'}
                </p>
                <button
                  className="button secondary"
                  disabled={!canNegotiate || contract.negotiatedYear === g.year}
                  onClick={() => setMeeting('support')}
                >
                  추가 지원 논의
                </button>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <section className="panel vision-requests">
          <h2>이사회에 요청하기</h2>
          <p>
            구단의 기대와 제공할 지원을 함께 이야기합니다. 개막 전 또는 취임 당일에 협상할 수
            있습니다.
          </p>
          <div className="vision-request-options">
            <button disabled={!canNegotiate} onClick={() => setMeeting('target')}>
              <Flag size={24} />
              <strong>시즌 기대 조정</strong>
              <span>목표 순위에 맞춰 감독 연봉을 협의합니다.</span>
            </button>
            <button
              disabled={!canNegotiate || contract.negotiatedYear === g.year}
              onClick={() => setMeeting('support')}
            >
              <Sprout size={24} />
              <strong>선수단에 투자해 주십시오.</strong>
              <span>육성·재정 약속을 제시하고 시설 또는 자금을 요청합니다.</span>
            </button>
          </div>
          {!canNegotiate && (
            <p>현재 협상 기간이 아닙니다. 다음 시즌 개막 전 다시 논의할 수 있습니다.</p>
          )}
        </section>
      )}
      <Dialog
        open={meeting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setMeeting(null);
        }}
      >
        <DialogContent className="board-meeting-dialog">
          <DialogHeader>
            <DialogTitle>
              이사회 면담 · {meeting === 'target' ? '시즌 기대' : '추가 지원'}
            </DialogTitle>
            <DialogDescription>“감독님의 계획을 듣겠습니다.”</DialogDescription>
          </DialogHeader>
          <div className="board-meeting-form">
            <Choice
              label="시즌 목표"
              value={String(target)}
              onChange={(v) => setTarget(Number(v))}
              items={Array.from({ length: max }, (_, i) => ({
                value: String(i + 1),
                label: `${i + 1}위 이내를 약속합니다.`,
              }))}
            />
            {meeting === 'support' && (
              <>
                <Choice
                  label="추가 운영 약속"
                  value={objective}
                  onChange={setObjective}
                  items={[
                    { value: 'youth', label: '23세 이하 출전 비중 15%' },
                    { value: 'wages', label: '선수 연봉 10% 절감' },
                    { value: 'profit', label: '기준 예산 5% 운영 흑자' },
                  ]}
                />
                <Choice
                  label="요청할 지원"
                  value={benefit}
                  onChange={setBenefit}
                  items={[
                    { value: 'training', label: '훈련시설을 개선해 주십시오.' },
                    { value: 'funds', label: '추가 운영 자금을 요청합니다.' },
                  ]}
                />
                <p>
                  현재 순위 약속을 유지하거나 높여 리그 상위 절반을 목표로 합니다. 지원 후에는
                  순위와 운영 약속을 모두 달성해야 합니다.
                </p>
              </>
            )}
          </div>
          <button
            className="button primary"
            disabled={busy || !canNegotiate}
            onClick={async () => {
              if (
                await act(
                  meeting === 'target'
                    ? { type: 'managerTarget', targetRank: target }
                    : { type: 'boardNegotiate', objective, benefit, targetRank: target },
                )
              )
                setMeeting(null);
            }}
          >
            이 조건으로 합의 제안
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
