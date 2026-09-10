'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Play, Pause, Settings2, Maximize } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
import { useIsMobile } from '../../hooks/use-mobile';
import { MobileMatchView, MatchAtBat } from './mobile-match-view';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { StadiumScene } from './stadium-replay';
import { MatchPlanEditor } from './match-plan-editor';
import { MatchCommandPanel } from './match-command-panel';
import { matchCommandLabels } from '@dugout/shared/match-commands';
import { isSpaceShortcut } from '../career/space-shortcut';

function readCursor(key: string, floor: number, length: number) {
  try {
    const stored = Number(localStorage.getItem(key));
    return Number.isInteger(stored) ? Math.max(floor, Math.min(length, stored)) : floor;
  } catch {
    return floor;
  }
}
function readSpeed() {
  try {
    const value = localStorage.getItem('dugout:match-speed');
    return value && ['1', '2', '4', '8'].includes(value) ? value : '2';
  } catch {
    return '2';
  }
}
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);
  const live = g.liveMatch!,
    result = live.timeline!,
    length = result.log.length;
  const { getClub } = useWorld(),
    reduced = useReducedMotion(),
    mobile = useIsMobile();
  const storageKey = `dugout:playback:${live.playbackId}:${live.timelineVersion}`;
  const [cursor, setCursor] = useState(() => readCursor(storageKey, live.cursor, length));
  const [playing, setPlaying] = useState(false),
    [commandOpen, setCommandOpen] = useState(false),
    [settled, setSettled] = useState(true),
    [editorOverride, setEditor] = useState<boolean | null>(null),
    [planDirty, setPlanDirty] = useState(false),
    [speed, setSpeed] = useState(readSpeed);
  const editor = editorOverride ?? (cursor === 0 && !mobile);
  const finished = cursor >= length;
  const queuedCommand = live.commands?.find((command) => command.cursor === cursor);
  const event = result.log[cursor - 1];
  useEffect(() => {
    try {
      localStorage.setItem('dugout:match-speed', speed);
    } catch {
      /* Playback works without storage. */
    }
  }, [speed]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(cursor));
    } catch {
      /* Server timeline remains durable. */
    }
  }, [cursor, storageKey]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) {
        setPlaying(false);
        setSettled(true);
      }
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  function next() {
    if (cursor < length) {
      setCommandOpen(false);
      setEditor(false);
      setSettled(false);
      setCursor(cursor + 1);
    }
  }
  function pause() {
    setPlaying(false);
    setSettled(true);
  }
  function finishPlay() {
    if (playing && cursor < length) setCursor(cursor + 1);
    else {
      setPlaying(false);
      setSettled(true);
    }
  }
  const sceneResult = cursor === 0 ? { ...result, log: [], homeScore: 0, awayScore: 0 } : result;
  return (
    <section
      ref={dialogRef}
      onKeyDown={(event) => {
        if (!isSpaceShortcut(event.nativeEvent)) return;
        event.preventDefault();
        event.stopPropagation();
        if (busy) return;
        if (editor && planDirty) {
          dialogRef.current?.querySelector('form')?.requestSubmit();
          return;
        }
        if (finished) {
          if (settled)
            void act({ type: 'completeMatch', cursor, timelineVersion: live.timelineVersion });
        } else if (playing) pause();
        else {
          setPlaying(true);
          next();
        }
      }}
      tabIndex={-1}
      aria-label="경기 지휘"
      className={`match-page live-match-dialog ${mobile && !editor ? 'mobile-live-layout' : ''} ${commandOpen ? 'command-open' : ''} ${queuedCommand ? 'has-queued-command' : ''}`}
    >
      <header className="stadium-replay-header">
        <div className="match-display-actions">
          <Link href="/?view=home" className="text-button">
            ← 구단 화면
          </Link>
          <button
            className="icon-button"
            aria-label="브라우저 전체 화면"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen().catch(() => {});
            }}
          >
            <Maximize size={16} />
          </button>
        </div>
        <h2>
          {getClub(live.away).name} <span>vs</span> {getClub(live.home).name}
        </h2>
        <p>
          {result.date} ·{' '}
          {finished
            ? '경기 종료'
            : cursor === 0
              ? '경기 프리뷰'
              : `${event?.inning}회 ${event?.half ? '말' : '초'}`}
        </p>
      </header>
      <ol className="match-flow-steps" aria-label="경기 진행 단계">
        {['경기 준비', '경기 지휘', '경기 후 보고'].map((label, i) => (
          <li
            key={label}
            aria-current={(finished ? 2 : cursor === 0 ? 0 : 1) === i ? 'step' : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
      {editor && !finished && mobile && (
        <details className="mobile-preview-teams">
          <summary>홈 · 원정 선발 명단 비교</summary>
          <MobileMatchView g={g} cursor={cursor} />
        </details>
      )}
      {editor && !finished && (
        <MatchPlanEditor
          key={`${cursor}:${live.timelineVersion}`}
          g={g}
          cursor={cursor}
          busy={busy}
          act={act}
          onDirty={setPlanDirty}
          onCancel={() => {
            setPlanDirty(false);
            setEditor(false);
          }}
          onApplied={() => setEditor(false)}
          onResume={() => {
            setPlaying(true);
            next();
          }}
        />
      )}

      <div className={`stadium-replay-layout ${editor && !finished ? 'is-planning' : ''}`}>
        <div className="stadium-main">
          {!editor &&
            (mobile ? (
              <MobileMatchView
                g={g}
                cursor={cursor}
                playing={!settled && cursor > 0}
                speed={Number(speed)}
                reduced={reduced}
                onEnd={finishPlay}
              />
            ) : (
              <>
                <MatchAtBat result={result} cursor={cursor} />
                <StadiumScene
                  key={`${cursor}:${settled}`}
                  result={sceneResult}
                  index={Math.max(0, cursor - 1)}
                  playing={!settled && cursor > 0}
                  speed={Number(speed)}
                  reduced={reduced || settled}
                  onEnd={finishPlay}
                />
              </>
            ))}
          {!editor && !finished && commandOpen && (
            <MatchCommandPanel g={g} cursor={cursor} busy={busy} act={act} />
          )}
          <div className="stadium-controls live-controls" hidden={editor}>
            {queuedCommand && !finished && (
              <div className="match-command-queued" role="status">
                <strong>{matchCommandLabels[queuedCommand.kind]} 지시 대기</strong>
                <button
                  disabled={busy || playing || !settled}
                  onClick={() =>
                    void act({
                      type: 'cancelMatchCommand',
                      cursor,
                      timelineVersion: live.timelineVersion,
                    })
                  }
                >
                  지시 취소
                </button>
              </div>
            )}
            <button
              className="replay-play"
              disabled={busy || finished || planDirty}
              onClick={() => {
                if (playing) pause();
                else {
                  setPlaying(true);
                  next();
                }
              }}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}{' '}
              {playing ? '일시정지' : cursor === 0 ? '플레이볼' : '경기 계속'}
            </button>
            <button
              className="button secondary compact"
              disabled={busy || playing || !settled || finished || planDirty}
              onClick={next}
            >
              다음 플레이
            </button>
            <select aria-label="경기 속도" value={speed} onChange={(e) => setSpeed(e.target.value)}>
              {['1', '2', '4', '8'].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
            <button
              className="button secondary compact"
              disabled={busy || finished || planDirty}
              onClick={() => {
                pause();
                setCommandOpen(false);
                setEditor(!editor);
              }}
            >
              <Settings2 size={15} /> 선수·전술
            </button>
            <button
              className="button secondary compact"
              disabled={busy || finished || planDirty}
              aria-expanded={commandOpen}
              aria-controls="match-command-panel"
              onClick={() => {
                pause();
                setCommandOpen(!commandOpen);
              }}
            >
              작전 지시
            </button>
            <span className="tiny">
              {planDirty
                ? '선수·전술 변경을 적용하거나 취소해 주세요.'
                : cursor === 0
                  ? '선수·전술에서 경기 계획을 준비하세요.'
                  : 'Space 재생·일시정지 · 작전 지시나 선수·전술을 누르면 잠시 멈춥니다.'}
            </span>
            {finished && (
              <button
                className="button primary compact"
                disabled={busy || !settled}
                onClick={() =>
                  void act({
                    type: 'completeMatch',
                    cursor,
                    timelineVersion: live.timelineVersion,
                  })
                }
              >
                결과 저장 · 경기 후 보고 →
              </button>
            )}
          </div>
        </div>
        {!editor && !mobile && (
          <aside className="stadium-match-report">
            <>
              <h3>경기 중계</h3>
              <p className="tiny">{finished ? '최종 기록' : '진행한 타석만 표시합니다.'}</p>
              <div className="replay-events">
                {result.log
                  .slice(0, cursor)
                  .slice(-12)
                  .map((e, i) => (
                    <div className="live-log" key={i}>
                      <small>
                        {e.inning}회 {e.half ? '말' : '초'}
                      </small>
                      <p>{e.text}</p>
                      <b>
                        {e.score[0]} : {e.score[1]}
                      </b>
                    </div>
                  ))}
              </div>
            </>
          </aside>
        )}
      </div>
    </section>
  );
}
