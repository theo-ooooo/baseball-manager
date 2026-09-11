'use client';
import Link from 'next/link';
import { Play, Pause, Settings2, Maximize, ArrowLeft } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
import { MobileMatchView, MatchAtBat } from './mobile-match-view';
import { StadiumScene } from './stadium-replay';
import { MatchPlanEditor } from './match-plan-editor';
import { MatchCommandPanel } from './match-command-panel';
import { matchCommandLabels } from '@dugout/shared/match-commands';
import { useLiveMatch } from './use-live-match';
import { MatchCardsPanel, MatchCardsSummary } from './match-cards-panel';
import { MatchCardHand } from './match-card-hand';
import { MatchEffectNotice } from './match-effect-notice';
import { MatchDelegation } from './match-delegation';
import { MatchPreview } from './match-preview';
import { MatchOverview } from './match-overview';
import { MatchAudioSettings } from './match-audio-settings';
import { AppVersion } from '../../components/app-version';
import { MatchDecisionBar } from './match-decision-bar';
import { CoachSubstitutionCard } from './coach-substitution-card';
import { CoachCommandCard } from './coach-command-card';
import { MatchSubstitutionNotice, MatchSubstitutionHistory } from './match-substitution-notice';
import { MatchCommandResultNotice, MatchCommandResultHistory } from './match-command-result-notice';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
export function LiveMatchScreen({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const live = g.liveMatch!;
  // Old partial matches are prepared by an explicit action, never by rendering or GET.
  if (!live.timeline)
    return (
      <section className="panel panel-content">
        <header>
          <h2>저장된 경기 이어가기</h2>
          <p>진행한 타석을 유지하고 남은 경기 기록을 준비합니다.</p>
        </header>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void act({ type: 'prepareMatch' })}
        >
          경기 기록 준비
        </button>
      </section>
    );
  return (
    <TimelinePlayer
      key={`${live.playbackId}:${live.timelineVersion}`}
      g={g}
      act={act}
      busy={busy}
    />
  );
}
function TimelinePlayer({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { dialogRef, ...m } = useLiveMatch(g, act, busy);
  const { getClub } = useWorld();
  const { live, result, cursor, settled, finished, playing, panel, queuedCommand } = m;
  const editor = panel === 'plan';
  const event = result.log[Math.max(0, cursor - 1)];
  return (
    <section
      ref={dialogRef}
      onKeyDown={m.onKeyDown}
      tabIndex={-1}
      aria-label="경기 지휘"
      className={`match-page match-center live-match-dialog ${panel === 'watch' ? 'is-watching' : ''} ${editor ? 'is-planning' : ''}`}
    >
      <header className="match-center-header">
        <Link href="/?view=home" className="match-back" aria-label="구단 화면으로">
          <ArrowLeft size={18} />
        </Link>
        <div className="match-center-title">
          <strong>
            {getClub(live.away).short} <span>vs</span> {getClub(live.home).short}
          </strong>
          <small>
            {result.date} ·{' '}
            {finished
              ? '경기 종료'
              : cursor === 0
                ? '경기 시작 전'
                : `${event?.inning}회 ${event?.half ? '말' : '초'}`}
          </small>
        </div>
        <nav aria-label="경기 화면">
          <button
            aria-current={panel === 'preview' ? 'page' : undefined}
            disabled={m.planDirty || busy || cursor > 0}
            onClick={() => m.showPanel('preview')}
          >
            프리뷰
          </button>
          <button
            aria-current={editor ? 'page' : undefined}
            disabled={m.planDirty || busy || finished}
            onClick={() => m.showPanel('plan')}
          >
            선수·전술
          </button>
          <button
            aria-current={panel === 'watch' ? 'page' : undefined}
            disabled={m.planDirty || busy || m.cardsPending}
            onClick={() => m.showPanel('watch')}
          >
            경기 중계
          </button>
        </nav>
        <MatchAudioSettings audio={m.audio} />
        <button
          className="match-fullscreen"
          aria-label="브라우저 전체 화면"
          onClick={m.toggleFullscreen}
        >
          <Maximize size={17} />
        </button>
      </header>
      {!finished && (
        <MatchDelegation
          g={g}
          act={act}
          busy={busy || m.planDirty}
          cursor={m.consumed}
          onStart={m.pause}
        />
      )}
      {live.cards?.selected && (panel === 'preview' || live.cards.version === 1) && (
        <MatchCardsSummary draft={live.cards} />
      )}
      {panel === 'preview' && (
        <MatchPreview
          g={g}
          busy={busy}
          onPlan={() => m.showPanel('plan')}
          onPlay={() => m.play()}
          onCards={() => m.setCardsOpen(true)}
        />
      )}
      <Dialog
        open={m.cardsOpen && m.cardsPending}
        onOpenChange={(open) => {
          if (!busy) m.setCardsOpen(open);
        }}
      >
        <DialogContent className="match-card-dialog" aria-modal="true">
          <DialogHeader>
            <DialogTitle>경기 카드 선택</DialogTitle>
            <DialogDescription>
              5장 중 3장을 고르세요. 기회·위기에 한 번씩 사용할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          {m.cardsPending && <MatchCardsPanel key={live.cards!.id} g={g} act={act} busy={busy} />}
        </DialogContent>
      </Dialog>
      {editor && (
        <div className="match-plan-page">
          <div className="match-plan-heading">
            <div>
              <small>{cursor ? '더그아웃 지시' : '경기 전 준비'}</small>
              <h2>선수 기용과 경기 계획</h2>
            </div>
            <button onClick={m.closePlan} disabled={m.planDirty || busy}>
              중계로 돌아가기
            </button>
          </div>
          <MatchPlanEditor
            key={`${m.consumed}:${live.timelineVersion}`}
            g={g}
            cursor={m.consumed}
            busy={busy}
            act={act}
            onDirty={m.setPlanDirty}
            onCancel={m.closePlan}
            onApplied={m.closePlan}
            onResume={() => m.play()}
          />
        </div>
      )}
      <div className="match-broadcast" hidden={panel !== 'watch'}>
        <div className="match-broadcast-main">
          <MatchAtBat result={result} cursor={cursor} settled={settled} />
          <MatchCommandResultNotice
            event={m.commandResults.current}
            onDismiss={m.commandResults.dismiss}
          />
          {live.cards?.version === 2 && (
            <MatchEffectNotice
              event={m.effects.event}
              draft={live.cards}
              onDismiss={m.effects.dismiss}
            />
          )}
          {live.cards?.version === 2 && live.cards.selected && (
            <MatchCardHand
              g={g}
              cursor={m.consumed}
              busy={busy}
              paused={!playing && settled && !finished}
              act={act}
            />
          )}
          <div className="match-field-view">
            <MatchSubstitutionNotice
              event={m.substitutions.current}
              onDismiss={m.substitutions.dismiss}
            />
            <StadiumScene
              replayKey={cursor}
              result={m.sceneResult}
              index={Math.max(0, cursor - 1)}
              playing={m.animating && panel === 'watch'}
              speed={Number(m.speed)}
              reduced={m.reduced}
              complete={settled}
              onEnd={m.finishPlay}
              onCue={m.onCue}
            />
            <MatchDecisionBar
              decision={m.decision}
              paused={m.decisionVisible && !m.commandOpen}
              pauseReason={m.pauseReason}
              busy={busy}
              onPlan={() => m.showPanel('plan')}
              onCommand={m.toggleCommand}
              onContinue={() => m.play()}
              previousCommand={m.previousCommand}
              onRepeat={m.repeatCommand}
              coach={
                <>
                  <CoachCommandCard
                    advice={m.commandAdvice}
                    busy={busy}
                    onSelect={m.reviewRecommendedCommand}
                  />
                  <CoachSubstitutionCard coach={m.coachSubstitution} busy={busy} />
                </>
              }
            />
          </div>
          <Dialog
            open={m.commandOpen && !finished}
            onOpenChange={() => {
              if (!busy) m.toggleCommand();
            }}
          >
            <DialogContent className="match-command-dialog">
              <DialogHeader>
                <DialogTitle>{m.decision.attacking ? '타자 작전' : '마운드 사인'}</DialogTitle>
                <DialogDescription>
                  {m.decision.situation} · 다음 타자 {m.decision.batter}
                </DialogDescription>
              </DialogHeader>
              <MatchCommandPanel
                g={g}
                cursor={m.consumed}
                busy={busy}
                act={act}
                initialCommand={m.commandPreset}
              />
            </DialogContent>
          </Dialog>
        </div>
        <aside className={`match-center-report ${m.report === 'lineup' ? 'is-lineup' : ''}`}>
          <nav aria-label="중계 정보">
            {(
              [
                ['overview', '전황'],
                ['commentary', '문자 중계'],
                ['lineup', '타순'],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                aria-current={m.report === tab ? 'page' : undefined}
                onClick={() => m.setReport(tab)}
              >
                {label}
              </button>
            ))}
          </nav>
          {m.report === 'overview' && (
            <>
              <MatchOverview result={result} consumed={m.consumed} />
              <MatchCommandResultHistory events={m.commandResults.events} />
              <MatchSubstitutionHistory events={m.substitutions.events} />
            </>
          )}
          {m.report === 'lineup' && <MobileMatchView g={g} cursor={m.consumed} />}
          {m.report === 'commentary' && (
            <div
              className="match-commentary-feed"
              role="log"
              aria-label="경기 문자 중계"
              aria-live="off"
            >
              {m.commentary.length ? (
                m.commentary.toReversed().map((cue) => (
                  <p key={cue.id} className={cue.final ? 'is-result' : ''}>
                    <small>{cue.final ? '타석 결과' : '현장 중계'}</small>
                    {cue.text}
                  </p>
                ))
              ) : (
                <p>플레이볼을 누르면 상황에 맞춰 중계가 시작됩니다.</p>
              )}
            </div>
          )}
        </aside>
      </div>
      {panel === 'watch' && (
        <footer className="match-center-controls">
          {queuedCommand && !finished && (
            <div className="match-command-queued">
              <strong>{matchCommandLabels[queuedCommand.kind]} 지시 대기</strong>
              <button
                disabled={busy || playing || !settled}
                onClick={() =>
                  void act({
                    type: 'cancelMatchCommand',
                    cursor: m.consumed,
                    timelineVersion: live.timelineVersion,
                  })
                }
              >
                지시 취소
              </button>
            </div>
          )}
          {!finished &&
            (m.decisionVisible && settled ? (
              <span className="match-playback-status">감독 결정 대기</span>
            ) : (
              <button
                className="match-start"
                disabled={busy || m.planDirty}
                onClick={() => (playing ? m.pause() : m.play())}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
                {playing ? '일시정지' : cursor === 0 ? '플레이볼' : '이 장면 계속'}
              </button>
            ))}
          {finished ? (
            <button className="match-start match-complete" disabled={busy} onClick={m.complete}>
              경기 후 보고 →
            </button>
          ) : (
            <span className="match-shortcut">Space 재생·일시정지</span>
          )}
          <details className="match-view-settings">
            <summary>
              <Settings2 size={15} /> 중계 설정 · {m.speed}×
            </summary>
            <div className="match-view-settings-content">
              <label className="match-speed-label">
                재생 속도
                <select
                  aria-label="경기 속도"
                  value={m.speed}
                  onChange={(e) => m.setSpeed(e.target.value)}
                >
                  {['1', '2', '4', '8'].map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="match-auto-pause">
                <legend>자동 일시정지</legend>
                {(['opportunity', 'threat'] as const).map((kind) => (
                  <label key={kind}>
                    <input
                      type="checkbox"
                      checked={m.autoPause.settings[kind]}
                      onChange={(e) => m.autoPause.toggle(kind, e.target.checked)}
                    />
                    {kind === 'opportunity' ? '득점 기회' : '실점 위기'}
                  </label>
                ))}
                <small role="status">{m.autoPause.label}</small>
              </fieldset>
            </div>
          </details>
          <AppVersion />
        </footer>
      )}
    </section>
  );
}
