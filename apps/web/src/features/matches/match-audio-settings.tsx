'use client';
import { Volume2, VolumeX, Mic2 } from 'lucide-react';
import type { useMatchAudio } from './use-match-audio';
export function MatchAudioSettings({ audio }: { audio: ReturnType<typeof useMatchAudio> }) {
  return (
    <details className="match-audio-settings">
      <summary>
        {audio.settings.effects ? <Volume2 size={17} /> : <VolumeX size={17} />}{' '}
        <span>사운드·해설</span>
      </summary>
      <div className="match-audio-popover">
        <strong>중계 사운드</strong>
        <label className="match-audio-toggle">
          <input
            type="checkbox"
            checked={audio.settings.effects}
            onChange={(e) => audio.update({ effects: e.target.checked })}
          />
          <span>관중·투구·타격·포구 효과음</span>
        </label>
        <label className="match-audio-volume">
          음량 <output>{Math.round(audio.settings.volume * 100)}%</output>
          <input
            aria-label="경기 사운드 음량"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={audio.settings.volume}
            onChange={(e) => audio.update({ volume: Number(e.target.value) })}
          />
        </label>
        <label className="match-audio-toggle">
          <input
            type="checkbox"
            checked={audio.settings.voice}
            disabled={!audio.voices.length}
            onChange={(e) => audio.update({ voice: e.target.checked })}
          />
          <span>
            <Mic2 size={14} /> 한국어 음성 해설
          </span>
        </label>
        {audio.voices.length ? (
          <>
            <select
              aria-label="해설 목소리"
              value={audio.selectedVoice?.voiceURI || ''}
              onChange={(e) => audio.update({ voiceURI: e.target.value })}
            >
              {audio.voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={audio.testVoice}>
              목소리 미리 듣기
            </button>
            <p>기기의 음성으로 타석 결과를 읽습니다. 1×·2× 속도에서 들을 수 있습니다.</p>
          </>
        ) : (
          <p>이 기기에는 한국어 음성이 없습니다. 텍스트 중계와 효과음은 이용할 수 있습니다.</p>
        )}
        {audio.error && <p role="status">{audio.error}</p>}
      </div>
    </details>
  );
}
