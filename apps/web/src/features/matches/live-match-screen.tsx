'use client';
import { useEffect, useState } from 'react';
import { Play, Pause, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { StadiumScene } from './stadium-replay';
import { MatchPlanEditor } from './match-plan-editor';

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
      <Dialog open>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>저장된 경기 이어가기</DialogTitle>
            <DialogDescription>
              진행한 타석을 유지하고 남은 경기 기록을 준비합니다.
            </DialogDescription>
          </DialogHeader>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void act({ type: 'prepareMatch' })}
          >
            경기 기록 준비
          </button>
        </DialogContent>
      </Dialog>
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
  const live = g.liveMatch!,
    result = live.timeline!,
    length = result.log.length;
  const { getClub } = useWorld(),
    reduced = useReducedMotion();
  const storageKey = `dugout:playback:${live.playbackId}:${live.timelineVersion}`;
  const [cursor, setCursor] = useState(() => readCursor(storageKey, live.cursor, length));
  const [playing, setPlaying] = useState(false),
    [settled, setSettled] = useState(true),
    [editor, setEditor] = useState(cursor === 0),
    [planDirty, setPlanDirty] = useState(false),
    [speed, setSpeed] = useState(readSpeed);
  const finished = cursor >= length;
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
      setEditor(false);
      setSettled(false);
      setCursor(cursor + 1);
    }
  }
  function pause() {
    setPlaying(false);
    setSettled(true);
  }
  const sceneResult = cursor === 0 ? { ...result, log: [], homeScore: 0, awayScore: 0 } : result;
  return (
    <Dialog open>
      <DialogContent
        className="stadium-replay-dialog live-match-dialog"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="stadium-replay-header">
          <DialogTitle>
            {getClub(live.away).name} <span>vs</span> {getClub(live.home).name}
          </DialogTitle>
          <DialogDescription>
            {result.date} ·{' '}
            {finished
              ? '경기 종료'
              : cursor === 0
                ? '경기 프리뷰'
                : `${event?.inning}회 ${event?.half ? '말' : '초'}`}
          </DialogDescription>
        </DialogHeader>
        <div className="stadium-replay-layout">
          <div className="stadium-main">
            <StadiumScene
              key={`${cursor}:${settled}`}
              result={sceneResult}
              index={Math.max(0, cursor - 1)}
              playing={!settled && cursor > 0}
              speed={Number(speed)}
              reduced={reduced || settled}
              onEnd={() => {
                if (playing && cursor < length) setCursor(cursor + 1);
                else {
                  setPlaying(false);
                  setSettled(true);
                }
              }}
            />
            <div className="stadium-controls live-controls">
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
                다음 타석
              </button>
              <select
                aria-label="경기 속도"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
              >
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
                  setEditor(!editor);
                }}
              >
                <Settings2 size={15} /> 선수·전술
              </button>
              <span className="tiny">
                {planDirty
                  ? '선수·전술 변경을 적용하거나 취소해 주세요.'
                  : '경기 기록 저장됨 · 재생 위치는 이 기기에 저장'}
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
                  결과 확인 · 더그아웃으로 →
                </button>
              )}
            </div>
          </div>
          <aside className="stadium-match-report">
            {editor && !finished ? (
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
              />
            ) : (
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
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
