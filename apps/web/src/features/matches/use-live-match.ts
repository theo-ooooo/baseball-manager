'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { isSpaceShortcut } from '../career/space-shortcut';
import { useMatchPlayback } from './use-match-playback';
import { useMatchAudio } from './use-match-audio';
import type { MatchCue } from './match-commentary';
import { useIsMobile } from '../../hooks/use-mobile';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export function useLiveMatch(g: GameState, act: Act, busy: boolean) {
  const live = g.liveMatch!,
    result = live.timeline!;
  const playback = useMatchPlayback(
    `dugout:playback:${live.playbackId}:${live.timelineVersion}`,
    live.cursor,
    result.log.length,
    busy,
  );
  const [panel, setPanel] = useState<'preview' | 'watch' | 'plan'>(() =>
    playback.cursor ? 'watch' : 'preview',
  );
  const [report, setReport] = useState<'overview' | 'commentary' | 'lineup'>('overview');
  const [commandOpen, setCommandOpen] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);
  const [commentary, setCommentary] = useState<MatchCue[]>([]);
  const [soundPaused, setSoundPaused] = useState(true);
  const dialogRef = useRef<HTMLElement>(null);
  const mobile = useIsMobile(),
    reduced = useReducedMotion();
  const audio = useMatchAudio(!soundPaused && panel === 'watch' && !busy, Number(playback.speed));
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);
  const pausePlayback = playback.pause;
  const pause = useCallback(() => {
    pausePlayback();
    setSoundPaused(true);
  }, [pausePlayback]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [pause]);
  const consumed = Math.max(live.cursor, playback.cursor - (playback.settled ? 0 : 1));
  const sceneResult = useMemo(
    () => (playback.cursor === 0 ? { ...result, log: [], homeScore: 0, awayScore: 0 } : result),
    [result, playback.cursor],
  );
  const showPanel = (next: typeof panel) => {
    if (planDirty || busy) return;
    pause();
    setCommandOpen(false);
    setPanel(next);
  };
  const play = (continuous = true) => {
    if (busy || planDirty || playback.finished) return;
    void audio.unlock();
    setSoundPaused(false);
    setPanel('watch');
    if (mobile && report === 'lineup') setReport('overview');
    setCommandOpen(false);
    playback.play(continuous);
  };
  const playAudioCue = audio.cue;
  const onCue = useCallback(
    (cue: MatchCue) => {
      setCommentary((previous) =>
        previous.some((entry) => entry.id === cue.id) ? previous : [...previous.slice(-39), cue],
      );
      playAudioCue(cue);
    },
    [playAudioCue],
  );
  const complete = () => {
    if (!busy && playback.finished)
      void act({
        type: 'completeMatch',
        cursor: playback.cursor,
        timelineVersion: live.timelineVersion,
      });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isSpaceShortcut(event.nativeEvent)) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (panel === 'plan' && planDirty) {
      dialogRef.current?.querySelector('form')?.requestSubmit();
      return;
    }
    if (playback.finished) complete();
    else if (playback.playing) pause();
    else play();
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return {
    ...playback,
    live,
    result,
    dialogRef,
    panel,
    showPanel,
    report,
    setReport: (next: typeof report) => {
      if (mobile && next === 'lineup') pause();
      setReport(next);
    },
    commandOpen,
    toggleCommand: () => {
      pause();
      setCommandOpen((previous) => !previous);
    },
    planDirty,
    setPlanDirty,
    closePlan: () => {
      setPlanDirty(false);
      setPanel(playback.cursor ? 'watch' : 'preview');
    },
    mobile,
    reduced,
    audio,
    commentary,
    onCue,
    consumed,
    sceneResult,
    play,
    pause,
    complete,
    onKeyDown,
    toggleFullscreen,
    queuedCommand: live.commands?.find((command) => command.cursor === consumed),
  };
}
