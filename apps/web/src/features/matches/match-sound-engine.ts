import type { MatchSound } from './match-commentary';

/** Locally synthesized stadium audio. No downloaded recordings or remote audio service. */
export function createMatchSound(context: AudioContext) {
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  const noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
  const samples = noise.getChannelData(0);
  let seed = 72831;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = seed / 2147483648 - 1;
  }
  const crowd = context.createBufferSource();
  crowd.buffer = noise;
  crowd.loop = true;
  const crowdFilter = context.createBiquadFilter();
  crowdFilter.type = 'lowpass';
  crowdFilter.frequency.value = 650;
  const crowdLevel = context.createGain();
  crowdLevel.gain.value = 0.075;
  crowd.connect(crowdFilter).connect(crowdLevel).connect(master);
  crowd.start();
  const sources = new Set<AudioScheduledSourceNode>();
  function burst(frequency: number, duration: number, level: number, highpass = false) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = highpass ? 'highpass' : 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const envelope = context.createGain(),
      now = context.currentTime;
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.exponentialRampToValueAtTime(level, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(envelope).connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
    sources.add(source);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      sources.delete(source);
    };
  }
  function knock(frequency: number, duration: number, level: number) {
    const source = context.createOscillator(),
      envelope = context.createGain(),
      now = context.currentTime;
    source.type = 'triangle';
    source.frequency.setValueAtTime(frequency, now);
    source.frequency.exponentialRampToValueAtTime(frequency * 0.32, now + duration);
    envelope.gain.setValueAtTime(level, now);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(envelope).connect(master);
    source.start();
    source.stop(now + duration);
    sources.add(source);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
      sources.delete(source);
    };
  }
  return {
    volume(value: number) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), context.currentTime, 0.025);
    },
    play(sound: MatchSound) {
      if (context.state !== 'running') return;
      if (sound === 'pitch') burst(1600, 0.17, 0.12, true);
      if (sound === 'bat') {
        burst(2300, 0.09, 0.7);
        knock(650, 0.1, 0.4);
      }
      if (sound === 'glove') {
        burst(480, 0.14, 0.4);
        knock(140, 0.12, 0.22);
      }
      if (sound === 'cheer') burst(950, 1.65, 0.38);
    },
    silence() {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
      for (const source of sources) {
        source.stop();
        source.disconnect();
      }
      sources.clear();
    },
    dispose() {
      crowd.stop();
      crowd.disconnect();
      crowdFilter.disconnect();
      crowdLevel.disconnect();
      master.disconnect();
    },
  };
}
