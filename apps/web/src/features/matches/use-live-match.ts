'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { isSpaceShortcut } from '../career/space-shortcut';
import { useMatchCompletion } from './use-match-completion';
import { useMatchPlayback } from './use-match-playback';
import { useMatchAudio } from './use-match-audio';
import type { MatchCue } from './match-commentary';
import { useIsMobile } from '../../hooks/use-mobile';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { previousMatchCommand, type MatchCommandKind } from '@dugout/shared/match-commands';
import { coachMatchCommand } from './coach-match-command';
import { sendMatchCommand } from './use-match-command';
import { matchDecision } from '@dugout/shared/match-decision';
import { useDecisionPrompt } from './use-decision-prompt';
import { useMatchPauseSettings, type MatchPauseSettings } from './use-match-pause-settings';
import { useMatchResume } from './use-match-resume';
import { useMatchSubstitutions } from './use-match-substitutions';
import { useCoachSubstitution } from './use-coach-substitution';
import { usePreviewSubstitution } from './use-preview-substitution';
import { useMatchCommandResults } from './use-match-command-results';
import { useMatchEffects } from './use-match-effects';

export function useLiveMatch(g: GameState, act: Act, busy: boolean) {
  const live = g.liveMatch!,
    result = live.timeline!;
  const resume = useMatchResume(live);
  const autoPause = useMatchPauseSettings();
  const shouldPause = useCallback(
    (cursor: number) => {
      const kind = matchDecision(live, g.club, cursor).kind;
      return !!kind && autoPause.enabled(kind);
    },
    [live, g.club, autoPause],
  );
  const playback = useMatchPlayback(
    `dugout:playback:${live.playbackId}:${live.timelineVersion}`,
    live.cursor,
    result.log.length,
    busy,
    shouldPause,
    resume,
  );
  useMatchCompletion(g, playback.finished, playback.cursor, busy, act);
  const [panel, setPanel] = useState<'preview' | 'watch' | 'plan'>(() =>
    playback.cursor ? 'watch' : 'preview',
  );
  const [report, setReport] = useState<'overview' | 'commentary' | 'lineup'>('overview');
  const substitutions = useMatchSubstitutions(
    live,
    g.club,
    playback.cursor,
    playback.animating,
    panel === 'watch',
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [commandPreset, setCommandPreset] = useState<MatchCommandKind>();
  const [planDirty, setPlanDirty] = useState(false);
  const [commentary, setCommentary] = useState<MatchCue[]>([]);
  const [soundPaused, setSoundPaused] = useState(!resume);
  const dialogRef = useRef<HTMLElement>(null);
  const mobile = useIsMobile(),
    reduced = useReducedMotion();
  const audio = useMatchAudio(
    !soundPaused && playback.playing && panel === 'watch' && !busy,
    Number(playback.speed),
  );
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);
  const pausePlayback = playback.pause;
  const pause = useCallback(() => {
    pausePlayback();
    setSoundPaused(true);
  }, [pausePlayback]);
  const consumed = Math.max(live.cursor, playback.cursor - (playback.settled ? 0 : 1));
  const effects = useMatchEffects(result, consumed, panel === 'watch');
  const cardsPending = !!live.cards && !live.cards.selected;
  useEffect(() => {
    if (!cardsPending) return;
    const timer = setTimeout(() => setCardsOpen(true), 1900);
    return () => clearTimeout(timer);
  }, [cardsPending]);
  const commandResults = useMatchCommandResults(
    result,
    consumed,
    g.club,
    panel === 'watch',
    live.commands,
  );
  const decision = useMemo(() => matchDecision(live, g.club, consumed), [live, g.club, consumed]);
  const commandAdvice = useMemo(
    () => (!playback.playing && playback.settled ? coachMatchCommand(g, consumed) : undefined),
    [g, consumed, playback.playing, playback.settled],
  );
  const previousCommand = previousMatchCommand(live, g.club, consumed);
  const coachSubstitution = useCoachSubstitution(
    g,
    consumed,
    busy,
    !playback.playing && playback.settled && panel === 'watch',
    act,
  );
  const previewSubstitution = usePreviewSubstitution(g, busy, panel === 'preview', act);
  const decisionVisible = useDecisionPrompt(
    playback.cursor,
    !playback.playing,
    playback.settled,
    playback.pauseReason === 'automatic',
  );
  const sceneResult = useMemo(
    () => (playback.cursor === 0 ? { ...result, log: [], homeScore: 0, awayScore: 0 } : result),
    [result, playback.cursor],
  );
  const showPanel = (next: typeof panel) => {
    if (planDirty || busy || (cardsPending && next === 'watch')) return;
    pause();
    setCommandOpen(false);
    setPanel(next);
  };
  const play = (continuous = true) => {
    if (busy || planDirty || playback.finished || cardsPending) return;
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
    substitutions,
    commandResults,
    effects,
    cardsPending,
    cardsOpen,
    setCardsOpen,
    coachSubstitution,
    previewSubstitution,
    autoPause: {
      ...autoPause,
      toggle: (kind: keyof MatchPauseSettings, checked: boolean) => {
        autoPause.toggle(kind, checked);
        if (!checked && playback.pauseReason === 'automatic' && decision.kind === kind) play();
      },
    },
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
    commandAdvice,
    commandPreset,
    reviewRecommendedCommand: () => {
      if (busy || !commandAdvice) return;
      pause();
      setCommandPreset(commandAdvice.command);
      setCommandOpen(true);
    },
    toggleCommand: () => {
      pause();
      setCommandPreset(undefined);
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
    decision,
    decisionVisible,
    previousCommand,
    repeatCommand: () => {
      if (
        !busy &&
        !playback.playing &&
        playback.settled &&
        previousCommand &&
        !previousCommand.reason
      )
        void sendMatchCommand(g, consumed, previousCommand.kind, act);
    },
    sceneResult,
    play,
    pause,
    complete,
    onKeyDown,
    toggleFullscreen,
    queuedCommand: live.commands?.find((command) => command.cursor === consumed),
  };
}
