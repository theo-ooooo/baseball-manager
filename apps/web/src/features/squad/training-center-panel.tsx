'use client';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Users,
  HeartPulse,
  ClipboardList,
  LockKeyhole,
} from 'lucide-react';
import { addDays } from '@dugout/shared/calendar';
import { isClubSeasonRest } from '@dugout/shared/season-status';
import type { GameState } from '@dugout/shared/types';
import {
  trainingSessions,
  trainingTemplates,
  type TrainingSession,
  type TrainingTemplate,
} from '@dugout/shared/training-center';
import { abilityLabels } from '@dugout/shared/development';
import { intensityLabels } from '@dugout/shared/training-plan';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { TrainingPlanForm } from '../players/training-plan-form';
import type { Act } from '../career/game-contracts';
import { useTrainingCenter, type TrainingCenterView } from './use-training-center';
import { TrainingStaffSettings, TrainingRestSettings } from './training-settings';

const slots = ['오전', '오후', '추가'];
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
export function TrainingCenterPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const t = useTrainingCenter(g, act, busy);
  return (
    <div className="training-center">
      <header className="training-hero">
        <div>
          <small>TRAINING GROUND</small>
          <h2>{isClubSeasonRest(g) ? '시즌 종료 · 선수단 휴식' : '다음 경기를 만드는 시간'}</h2>
          <p>
            {isClubSeasonRest(g)
              ? '우리 팀 경기가 끝나 1·2군 모두 휴식합니다. 다음 시즌부터 훈련과 기용 추천을 다시 시작합니다.'
              : '주간 일정과 개인 훈련을 함께 관리하세요.'}
          </p>
        </div>
        <span className="training-owner">
          <ClipboardList size={16} />
          {t.center.responsibility === 'staff' ? '코치진이 일정 관리 중' : '감독이 일정 관리 중'}
        </span>
      </header>
      {g.liveMatch && (
        <p className="training-notice">
          경기 중에는 계획을 확인할 수 있습니다. 변경은 경기를 마친 뒤 가능합니다.
        </p>
      )}
      <div className="training-summary">
        <div>
          <span>오늘 예상 평균 부담</span>
          <strong>
            {t.overview.average.toFixed(1)}
            <small> / 높음 기준 3.0</small>
          </strong>
        </div>
        <div>
          <span>휴식 · 의무팀 관리</span>
          <strong>
            {t.overview.rest}
            <small>명</small>
          </strong>
        </div>
        <div>
          <span>높은 훈련 부담</span>
          <strong>
            {t.overview.heavy}
            <small>명</small>
          </strong>
        </div>
      </div>
      <nav className="training-tabs" aria-label="훈련 센터">
        {(
          [
            ['schedule', '주간 일정', CalendarDays],
            ['individual', '개인 훈련', Users],
            ['staff', '코치 담당', ClipboardList],
            ['rest', '휴식 · 보고', HeartPulse],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={t.tab === id ? 'page' : undefined}
            onClick={() => t.setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      {t.tab === 'schedule' && <TrainingSchedule t={t} />}
      {t.tab === 'individual' && (
        <section className="training-individual">
          <div className="training-toolbar">
            <SquadChoice t={t} />
            <input
              aria-label="훈련 선수 검색"
              placeholder="선수 이름 검색"
              value={t.query}
              onChange={(e) => t.setQuery(e.target.value)}
            />
          </div>
          <p className="training-note">
            현재 컨디션 기준 예상입니다. 경기 출전 후에는 피로를 다시 확인해 자동 휴식과 강도를
            적용합니다. 선수 이름을 눌러 개인 계획을 조정하세요.
          </p>
          <div className="training-players">
            {t.players.map(({ p, training }) => (
              <button
                key={p.id}
                onClick={() => t.openPlayer(p)}
                className={`training-player ${training.rest ? 'is-resting' : training.load > 3 ? 'is-heavy' : ''}`}
              >
                <span className="training-player-name">
                  <b>{p.name}</b>
                  <small>
                    {p.pos} · {p.age}세 · 컨디션 {Math.round(p.condition)}%
                  </small>
                </span>
                <span>
                  {!p.trainingPlan || p.trainingPlan.focus === 'balanced'
                    ? '균형 육성'
                    : p.trainingPlan.focus === 'rest'
                      ? '개인 휴식'
                      : abilityLabels[p.trainingPlan.focus]}
                  <small>{intensityLabels[p.trainingPlan?.intensity || 'normal']}</small>
                </span>
                <span>
                  <b>{training.rest ? '휴식' : `부담 ${training.load.toFixed(1)}`}</b>
                  <small>{training.reason}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          {!t.players.length && <p className="training-note">해당 선수가 없습니다.</p>}
        </section>
      )}
      {t.tab === 'staff' && <TrainingStaffSettings g={g} t={t} />}
      {t.tab === 'rest' && <TrainingRestSettings t={t} />}
      <Dialog
        open={!!t.selected}
        onOpenChange={(open) => {
          if (!open) t.setSelected(null);
        }}
      >
        <DialogContent className="training-session-dialog">
          <DialogHeader>
            <DialogTitle>
              {t.selected?.date.slice(5)} · {slots[t.selected?.slot || 0]} 훈련
            </DialogTitle>
            <DialogDescription>
              세션을 선택한 뒤 주간 계획을 저장하세요. 추가 훈련은 컨디션 회복과 함께 검토하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="training-session-choices">
            {(Object.keys(trainingSessions) as TrainingSession[])
              .filter((s) => s !== 'match')
              .map((s) => (
                <button
                  key={s}
                  className={`session-${trainingSessions[s].group}`}
                  onClick={() => t.chooseSession(s)}
                  disabled={t.blocked}
                  aria-pressed={
                    t.days.find((d) => d.date === t.selected?.date)?.slots[
                      t.selected?.slot || 0
                    ] === s
                  }
                >
                  <strong>
                    {trainingSessions[s].label}
                    <small>부담 {trainingSessions[s].load.toFixed(1)}</small>
                  </strong>
                  <span>{trainingSessions[s].detail}</span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!t.player}
        onOpenChange={(open) => {
          if (!open) t.closePlayer();
        }}
      >
        <DialogContent className="training-player-dialog">
          <DialogHeader>
            <DialogTitle>{t.player?.name} · 개인 훈련</DialogTitle>
            <DialogDescription>
              팀 주간 일정에 개인 목표와 강도를 더합니다. 휴식일과 의무팀 관리는 우선 적용됩니다.
            </DialogDescription>
          </DialogHeader>
          {t.player && (
            <TrainingPlanForm
              key={`${t.player.id}:${JSON.stringify(t.player.trainingPlan)}`}
              player={t.player}
              g={g}
              act={act}
              busy={t.blocked}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function SquadChoice({ t }: { t: TrainingCenterView }) {
  return (
    <div className="training-squad-choice">
      {(['first', 'reserve'] as const).map((s) => (
        <button
          key={s}
          aria-pressed={t.squad === s}
          disabled={t.dirty}
          onClick={() => t.setSquad(s)}
        >
          {s === 'first' ? '1군' : '2군'}
        </button>
      ))}
    </div>
  );
}
function TrainingSchedule({ t }: { t: TrainingCenterView }) {
  return (
    <section className="training-schedule">
      <div className="training-toolbar">
        <SquadChoice t={t} />
        <div className="training-week-nav">
          <button
            aria-label="이전 훈련 주"
            disabled={t.week === 0 || t.dirty}
            onClick={() => t.setWeek(t.week - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <strong>
            {t.days[0].date.slice(5)} — {t.days[6].date.slice(5)}
          </strong>
          <button
            aria-label="다음 훈련 주"
            disabled={t.week === 3 || t.dirty}
            onClick={() => t.setWeek(t.week + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="training-presets">
        <Dumbbell size={16} />
        <span>이번 주 프로그램</span>
        {(
          Object.entries(trainingTemplates) as [
            TrainingTemplate,
            (typeof trainingTemplates)[TrainingTemplate],
          ][]
        ).map(([key, template]) => (
          <button
            key={key}
            disabled={t.blocked}
            aria-pressed={t.activeTemplate === key}
            onClick={() => t.applyTemplate(key)}
          >
            {template.label}
          </button>
        ))}
      </div>
      <div className="training-calendar">
        {t.days.map((day) => {
          const past = day.date < t.today,
            editable = !past && day.date <= addDays(t.today, 27) && !t.blocked;
          return (
            <article
              key={day.date}
              className={`training-day ${day.date === t.today ? 'is-today' : ''} ${past ? 'is-past' : ''}`}
            >
              <header>
                <b>{weekdays[new Date(day.date + 'T12:00:00Z').getUTCDay()]}</b>
                <span>{day.date.slice(5).replace('-', '/')}</span>
                {day.date === t.today && <small>오늘</small>}
              </header>
              <p className="training-fixture">{day.opponent || '경기 없음'}</p>
              {past ? (
                <p className="training-day-past">지난 날짜</p>
              ) : (
                <div className="training-day-slots">
                  {day.slots.map((session, index) => (
                    <button
                      key={index}
                      disabled={!editable || (day.match && index === 1)}
                      className={`training-slot session-${trainingSessions[session].group}`}
                      onClick={() => t.setSelected({ date: day.date, slot: index })}
                      aria-label={`${day.date} ${slots[index]} ${trainingSessions[session].label}`}
                    >
                      <small>
                        {slots[index]}
                        {session === 'match' && <LockKeyhole size={11} />}
                      </small>
                      <strong>{trainingSessions[session].label}</strong>
                      <span>
                        {session === 'match'
                          ? '경기 시간 확보'
                          : `부담 ${trainingSessions[session].load.toFixed(1)}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className={`training-save-bar ${t.dirty ? 'is-dirty' : ''}`}>
        <div>
          <strong>
            {t.dirty
              ? '저장하지 않은 변경이 있습니다'
              : t.center.responsibility === 'staff'
                ? '코치가 경기 전 준비와 회복을 배치합니다'
                : '저장된 훈련 계획'}
          </strong>
          <p>
            {t.dirty
              ? '계획을 저장하면 감독이 일정을 관리합니다.'
              : '경기는 오후 시간을 확보합니다. 선수별 실제 부담은 컨디션·개인 강도에 따라 달라집니다.'}
          </p>
        </div>
        {t.dirty && (
          <button className="button secondary" disabled={t.blocked} onClick={t.discard}>
            변경 취소
          </button>
        )}
        {t.dirty && (
          <button
            className="button primary"
            disabled={t.blocked}
            onClick={() => void t.saveSchedule()}
          >
            주간 계획 저장
          </button>
        )}
      </div>
    </section>
  );
}
