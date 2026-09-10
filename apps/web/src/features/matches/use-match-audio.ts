'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchCue } from './match-commentary';
import { createMatchSound } from './match-sound-engine';

type AudioSettings = { effects: boolean; voice: boolean; volume: number; voiceURI: string };
const defaults: AudioSettings = { effects: false, voice: false, volume: 0.45, voiceURI: '' };
function readSettings(): AudioSettings {
  try {
    const saved = JSON.parse(localStorage.getItem('dugout:match-audio:v1') || '{}');
    return {
      effects: saved.effects === true,
      voice: saved.voice === true,
      volume:
        typeof saved.volume === 'number' ? Math.max(0, Math.min(1, saved.volume)) : defaults.volume,
      voiceURI: typeof saved.voiceURI === 'string' ? saved.voiceURI : '',
    };
  } catch {
    return defaults;
  }
}

export function useMatchAudio(active: boolean, speed: number) {
  const [settings, setSettings] = useState(readSettings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const audio = useRef<{
    context: AudioContext;
    engine: ReturnType<typeof createMatchSound>;
  } | null>(null);
  const alive = useRef(true);
  const selectedVoice = voices.find((v) => v.voiceURI === settings.voiceURI) || voices[0];
  useEffect(() => {
    alive.current = true;
    const speech = window.speechSynthesis;
    const update = () =>
      setVoices(
        speech?.getVoices().filter((v) => /^ko(?:-|_)/i.test(v.lang) || v.lang === 'ko') || [],
      );
    update();
    speech?.addEventListener('voiceschanged', update);
    return () => {
      alive.current = false;
      speech?.removeEventListener('voiceschanged', update);
      speech?.cancel();
      audio.current?.engine.silence();
      audio.current?.engine.dispose();
      void audio.current?.context.close().catch(() => {});
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('dugout:match-audio:v1', JSON.stringify(settings));
    } catch {
      /* Optional settings. */
    }
  }, [settings]);
  // Called from a real click/keyboard event, including when saved settings are restored.
  const unlock = useCallback(async () => {
    if (!alive.current) return;
    setUnlocked(true);
    if (!settings.effects) return;
    try {
      if (!audio.current) {
        const context = new AudioContext();
        audio.current = { context, engine: createMatchSound(context) };
      }
      await audio.current.context.resume();
      if (alive.current) setError('');
    } catch {
      if (alive.current) setError('이 브라우저에서 사운드를 시작할 수 없습니다.');
    }
  }, [settings.effects]);
  useEffect(() => {
    const target = audio.current;
    if (target) {
      if (active && settings.effects && unlocked) {
        target.engine.volume(settings.volume);
        void target.context.resume().catch(() => {});
      } else {
        target.engine.silence();
        void target.context.suspend().catch(() => {});
      }
    }
    if (!active || !settings.voice || !unlocked || speed > 2) window.speechSynthesis?.cancel();
  }, [active, settings.effects, settings.voice, settings.volume, unlocked, speed]);
  const update = (patch: Partial<AudioSettings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
    setUnlocked(true);
    // Create/resume in the toggle's gesture, not an effect subject to autoplay restrictions.
    if (patch.effects) {
      try {
        if (!audio.current) {
          const context = new AudioContext();
          audio.current = { context, engine: createMatchSound(context) };
        }
        void audio.current.context.resume().catch(() => {
          if (alive.current) setError('사운드 재생이 차단되었습니다.');
        });
      } catch {
        setError('이 브라우저는 경기 사운드를 지원하지 않습니다.');
      }
    }
  };
  const cue = useCallback(
    (entry: MatchCue) => {
      if (!active || !unlocked || document.hidden) return;
      if (settings.effects && entry.sound) audio.current?.engine.play(entry.sound);
      if (!settings.voice || !selectedVoice || !entry.final || speed > 2 || !window.speechSynthesis)
        return;
      // Drop stale speech; a fast match must never accumulate an announcement backlog.
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(entry.text);
      utterance.voice = selectedVoice;
      utterance.lang = 'ko-KR';
      utterance.rate = speed === 2 ? 1.25 : 1;
      utterance.volume = settings.volume;
      window.speechSynthesis.speak(utterance);
    },
    [active, unlocked, settings, selectedVoice, speed],
  );
  const testVoice = () => {
    if (!selectedVoice) return;
    window.speechSynthesis.cancel();
    const sample = new SpeechSynthesisUtterance('안녕하세요. 더그아웃 야구 중계입니다. 플레이볼!');
    sample.voice = selectedVoice;
    sample.lang = 'ko-KR';
    sample.volume = settings.volume;
    window.speechSynthesis.speak(sample);
  };
  return { settings, voices, selectedVoice, error, update, unlock, cue, testVoice };
}
