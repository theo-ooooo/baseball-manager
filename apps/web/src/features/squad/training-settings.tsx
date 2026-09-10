'use client';
import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import {
  trainingCoach,
  trainingDisciplines,
  type TrainingDiscipline,
} from '@dugout/shared/training-center';
import type { TrainingCenterView } from './use-training-center';

export function TrainingStaffSettings({ g, t }: { g: GameState; t: TrainingCenterView }) {
  const projected = { ...g, trainingCenter: { ...t.center, coaches: t.coaches } };
  return (
    <section className="training-settings-panel">
      <header>
        <h3>훈련 책임과 코치 담당</h3>
        <p>
          전문 분야를 맡기고 담당이 한 코치에게 몰리지 않도록 배분하세요. 1군과 2군은 같은 코치진의
          지도를 받습니다.
        </p>
      </header>
      <label>
        주간 일정 담당
        <select
          value={t.responsibility}
          disabled={t.blocked}
          onChange={(e) => t.setResponsibility(e.target.value as 'staff' | 'manager')}
        >
          <option value="staff">코치진에게 위임</option>
          <option value="manager">감독이 직접 관리</option>
        </select>
        <small>
          코치에게 맡기면 경기 전 준비와 회복을 자동 배치합니다. 기존 수동 일정은 보관되며 감독
          관리로 돌리면 다시 적용됩니다.
        </small>
      </label>
      <div className="training-coach-grid">
        {(Object.entries(trainingDisciplines) as [TrainingDiscipline, string][]).map(
          ([key, label]) => {
            const assigned = trainingCoach(projected, key);
            return (
              <label className="training-coach-card" key={key}>
                <b>{label} 훈련</b>
                <select
                  value={t.coaches[key] || ''}
                  disabled={t.blocked}
                  onChange={(e) =>
                    t.setCoaches((previous) => ({ ...previous, [key]: e.target.value }))
                  }
                >
                  <option value="">해당 보직 코치에게 자동 배정</option>
                  {g.staff
                    .filter((c) => c.role !== '스카우트')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.role}
                      </option>
                    ))}
                </select>
                <span>
                  {assigned.coach?.name || '담당 공석'} ·{' '}
                  {assigned.coach ? `${assigned.count}개 분야 담당` : '대체 지도'}
                </span>
                <small>
                  {assigned.specialist ? '전문 분야 지도' : '비전문 분야 · 지도 효율 감소'}
                  {assigned.count > 1 ? ' · 중복 담당에 따른 부담' : ''}
                </small>
              </label>
            );
          },
        )}
      </div>
      <div className="training-settings-actions">
        <Link className="button secondary" href="/?view=staff">
          코치진 관리
        </Link>
        <button className="button primary" disabled={t.blocked} onClick={() => void t.saveStaff()}>
          담당 설정 저장
        </button>
      </div>
    </section>
  );
}
export function TrainingRestSettings({ t }: { t: TrainingCenterView }) {
  const report = t.center.report;
  return (
    <div className="training-rest-layout">
      <section className="training-settings-panel">
        <header>
          <h3>컨디션에 따른 자동 조절</h3>
          <p>
            선수에게 무리가 쌓이면 훈련을 낮춥니다. 경기 출전 여부는 선발 명단에서 따로 결정합니다.
          </p>
        </header>
        <div className="training-rest-fields">
          <label>
            이 컨디션 미만이면 훈련 휴식
            <select
              disabled={t.blocked}
              value={t.restBelow}
              onChange={(e) => t.setRestBelow(Number(e.target.value))}
            >
              {[40, 50, 60, 65, 70].map((n) => (
                <option key={n} value={n}>
                  {n}% 미만
                </option>
              ))}
            </select>
          </label>
          <label>
            이 컨디션 미만이면 절반 강도
            <select
              disabled={t.blocked}
              value={t.lightBelow}
              onChange={(e) => t.setLightBelow(Number(e.target.value))}
            >
              {[60, 70, 75, 80, 85, 90].map((n) => (
                <option key={n} value={n} disabled={n <= t.restBelow}>
                  {n}% 미만
                </option>
              ))}
            </select>
          </label>
        </div>
        <ol className="training-rest-guide">
          <li>
            <strong>의무팀 관리 · 개인 휴식</strong>
            <span>부상 치료나 개인 휴식일에는 단체 훈련에서 빠집니다.</span>
          </li>
          <li>
            <strong>컨디션 {t.restBelow}% 미만</strong>
            <span>휴식을 우선해 회복을 돕습니다.</span>
          </li>
          <li>
            <strong>
              {t.restBelow}% 이상 ~ {t.lightBelow}% 미만
            </strong>
            <span>개인 강도에 앞서 팀 훈련량을 절반으로 줄입니다.</span>
          </li>
          <li>
            <strong>{t.lightBelow}% 이상</strong>
            <span>팀 일정과 개인 강도를 그대로 적용합니다.</span>
          </li>
        </ol>
        <button
          className="button primary"
          disabled={t.blocked || t.lightBelow <= t.restBelow}
          onClick={() => void t.saveRest()}
        >
          휴식 기준 저장
        </button>
      </section>
      <section className="training-settings-panel">
        <header>
          <h3>최근 코치 보고</h3>
          <p>7일의 실제 훈련 결과를 모아 수신함으로 보고합니다.</p>
        </header>
        {report ? (
          <>
            <p>
              {report.from} — {report.date}
            </p>
            <dl className="training-report">
              <div>
                <dt>평균 일일 부담</dt>
                <dd>{report.averageLoad.toFixed(1)}</dd>
              </div>
              <div>
                <dt>휴식 적용</dt>
                <dd>{report.rested}인일</dd>
              </div>
              <div>
                <dt>높은 부담</dt>
                <dd>{report.heavy}인일</dd>
              </div>
            </dl>
            <small>
              인일은 선수별 훈련일을 더한 수입니다. 예: 선수 3명이 이틀 휴식하면 6인일입니다.
            </small>
            <Link className="text-button" href="/?view=inbox">
              수신함에서 보고 확인 →
            </Link>
          </>
        ) : (
          <p className="training-note">
            아직 주간 보고가 없습니다. 날짜를 진행하면 실제 훈련을 집계합니다.
          </p>
        )}
      </section>
    </div>
  );
}
