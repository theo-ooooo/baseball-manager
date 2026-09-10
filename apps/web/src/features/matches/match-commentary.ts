import type { replayScene } from '@dugout/shared/replay';
export type MatchSound = 'pitch' | 'bat' | 'glove' | 'cheer';
export type MatchCue = {
  id: string;
  at: number;
  text: string;
  sound?: MatchSound;
  final?: boolean;
};

// These cues describe the stored play as it unfolds; outcomes stay behind the reveal boundary.
export function matchCommentary(scene: ReturnType<typeof replayScene>, key: string): MatchCue[] {
  if (!scene.event) return [];
  const cue = (
    name: string,
    at: number,
    text: string,
    sound?: MatchSound,
    final?: boolean,
  ): MatchCue => ({ id: `${key}:${name}`, at, text, sound, final });
  const before = scene.play?.before;
  const situation = before
    ? `${before.outs}아웃, ${
        before.bases
          .map((id, i) => (id ? `${i + 1}루` : ''))
          .filter(Boolean)
          .join('·') || '주자 없는 상황'
      }. `
    : '';
  const scored =
    !!scene.play && scene.play.after.score.some((n, i) => n > scene.play!.before.score[i]);
  if (scene.play?.plateAppearance === false)
    return [
      cue('runner', 0, `${scene.batter || '주자'}, 다음 베이스를 노립니다.`),
      cue('throw', 0.15, '포수가 공을 뿌립니다!', 'pitch'),
      cue('catch', 0.8, '베이스에서 승부!', 'glove'),
      cue('result', 1, scene.event.text, scored ? 'cheer' : undefined, true),
    ];
  if (scene.kind === 'tiebreak') return [cue('result', 1, scene.event.text, undefined, true)];
  const cues = [
    cue('ready', 0, `${situation}${scene.batter || '타자'}, 타석에 들어섭니다.`),
    cue('pitch', 0.06, `${scene.pitcher || '투수'}, 던졌습니다.`, 'pitch'),
  ];
  if (['walk', 'strikeout'].includes(scene.kind)) {
    cues.push(cue('catch', 0.38, '공이 포수 미트로 들어갑니다.', 'glove'));
  } else {
    cues.push(
      cue(
        'contact',
        0.2,
        scene.play?.command === 'bunt'
          ? '배트를 짧게 대며 번트!'
          : scene.fly
            ? '쳤습니다! 외야로 뻗는 타구!'
            : '쳤습니다! 내야를 향하는 타구!',
        'bat',
      ),
    );
    if (scene.kind !== 'homeRun')
      cues.push(cue('field', 0.65, '수비수가 타구를 처리합니다.', 'glove'));
  }
  const score = scored ? ` 스코어 ${scene.event.score[0]} 대 ${scene.event.score[1]}.` : '';
  cues.push(cue('result', 1, `${scene.event.text}${score}`, scored ? 'cheer' : undefined, true));
  return cues;
}

export function visibleMatchCues(cues: MatchCue[], progress: number) {
  return cues.filter((cue) => cue.at <= progress);
}
