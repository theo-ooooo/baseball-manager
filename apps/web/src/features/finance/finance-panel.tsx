'use client';
import { financePlan } from '@dugout/shared/club-finance';
import { useWorld } from '../career/world-context';
import { ArrowUpRight, Banknote, Trophy, Users, Wallet } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import type { FinanceEntry } from '@dugout/shared/types';
import { type GameState, money } from '@dugout/shared/game-view';
import { dateLabel } from '@dugout/shared/calendar';
import { Metric, Empty } from '../../components/game-ui';

export function Finance({ g, ledger }: { g: GameState; ledger: FinanceEntry[] }) {
  const { getClub } = useWorld();
  const plan = financePlan(g, getClub(g.club).league);
  const wages = g.roster.reduce((s, p) => s + p.salary, 0),
    coaches = g.staff.reduce((s, c) => s + c.salary, 0);
  return (
    <>
      <div className="metrics">
        <Metric
          label="현재 잔액"
          value={money(g.budget)}
          sub="영입 및 운영 예산"
          icon={<Wallet size={18} />}
        />
        <Metric
          label="이번 시즌 수입"
          value={money(g.income)}
          sub="스폰서·중계 지원금 · 경기 · 매각 · 상금"
          icon={<ArrowUpRight size={18} />}
        />
        <Metric
          label="이번 시즌 지출"
          value={money(g.expenses)}
          sub="급여 · 계약금 · 이적료 · 수수료"
          icon={<Banknote size={18} />}
        />
        <Metric
          label="총 연간 급여"
          value={money(wages + coaches + (g.managerCareer?.contract?.salary || 0))}
          sub="선수·코치·감독의 연봉 합계"
          icon={<Users size={18} />}
        />
      </div>
      <section className="panel ledger-panel">
        <div className="panel-header">
          <h2>거래 내역</h2>
          <span>감독 커리어 전체 · 최근 60건 · 구단 변경 전 내역 포함</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시즌 · 일차</TableHead>
              <TableHead>내용</TableHead>
              <TableHead>변동</TableHead>
              <TableHead>잔액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  {e.year} · {dateLabel(g, e.day)}
                </TableCell>
                <TableCell>
                  {{
                    start: '구단 운영 자금',
                    advance: '경기 수입 · 급여',
                    continue: '날짜 진행 · 경기 수입 · 급여',
                    continueDay: '날짜 진행 · 경기 수입 · 급여',
                    sign: '선수 계약',
                    sell: '선수 매각',
                    coach: '코치 계약',
                    signCoach: '코치 계약 · 교체 보상금',
                    nextSeason: '새 시즌 지원금',
                    signManager: '새 소속 구단의 운영 잔액 인계',
                    managerContinue: '휴가·구직 기간 정산',
                  }[e.kind] || e.kind}
                </TableCell>
                <TableCell className={e.amount > 0 ? 'accent' : ''}>
                  {e.amount > 0 ? '+' : '−'}
                  {money(Math.abs(e.amount))}
                </TableCell>
                <TableCell>{money(e.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!ledger.length && <Empty text="아직 거래 내역이 없습니다." />}
      </section>
      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h2>연봉 상위 선수</h2>
            <span>게임 내 계약</span>
          </div>
          <div className="salary-list">
            {[...g.roster]
              .sort((a, b) => b.salary - a.salary)
              .slice(0, 10)
              .map((p) => (
                <div key={p.id}>
                  <strong>{p.name}</strong>
                  <span className="muted">{p.years}년</span>
                  <div>
                    <Progress
                      value={(p.salary / Math.max(...g.roster.map((p) => p.salary))) * 100}
                    />
                  </div>
                  <b>{money(p.salary)}</b>
                </div>
              ))}
          </div>
        </section>
        <div>
          <section className="panel">
            <div className="panel-header">
              <h2>운영 구조</h2>
            </div>
            <div className="panel-content finance-details">
              <div>
                <span>선수 연봉 합계</span>
                <strong>{money(wages)}</strong>
              </div>
              <div>
                <span>코치 연봉 합계</span>
                <strong>{money(coaches)}</strong>
              </div>
              <div>
                <span>하루 급여 지출</span>
                <strong>{money(plan.dailyWages)}</strong>
              </div>
              <div>
                <span>하루 스폰서·중계 지원금</span>
                <strong>{money(plan.dailySupport)}</strong>
              </div>
              <div>
                <span>감독 연봉</span>
                <strong>{money(g.managerCareer?.contract?.salary || 0)}</strong>
              </div>
              <p>
                지원금은 시즌 시작 시 계약된 금액입니다. 추가 영입으로 지출이 늘어도 자동 증액되지
                않습니다. 급여와 지원금은 시즌별 정산 일정에 따라 지급됩니다.
              </p>
              <p>
                금액은 원화로 표시하며 계약 연봉은 만 원 단위로 입력합니다. 게임 고정 환산 기준은
                1달러 = 1,400원이며, 실제 환율·선수 연봉과는 다릅니다.
              </p>
              <p>
                홈 경기는 원정 경기보다 수입이 높고, 승리하면 보너스 수입이 발생합니다. 새 시즌에는
                구단 지원금이 지급됩니다.
              </p>
            </div>
          </section>
          <section className="panel training-block">
            <div className="panel-header">
              <h2>커리어 기록</h2>
              <Trophy size={18} />
            </div>
            {g.past.length ? (
              <div className="panel-content">
                {g.past.map((y) => (
                  <div className="career-record" key={y.year}>
                    <strong>{y.year}</strong>
                    <span>
                      {y.rank}위 · {y.w}승 {y.l}패
                    </span>
                    {y.champion === g.club && <span className="pill lime">우승</span>}
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="첫 시즌을 마치면 커리어 기록이 남습니다." />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
