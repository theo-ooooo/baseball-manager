export const pitchingApproaches = {
  balanced: { label: '균형 있게', benefit: '투타 능력과 상황에 맞춰 승부', cost: '기본 투구 방침' },
  attack: {
    label: '스트라이크 승부',
    benefit: '볼넷을 줄이고 빠르게 승부',
    cost: '안타·장타 허용 위험 증가',
  },
  corners: {
    label: '유인구 승부',
    benefit: '삼진과 약한 타구를 노림',
    cost: '볼넷·체력 소모 증가 · 제구 중요',
  },
  groundball: {
    label: '낮게 승부',
    benefit: '장타를 억제하고 병살을 유도',
    cost: '삼진 감소 · 단타 허용 위험 증가',
  },
} as const;
export type PitchingApproach = keyof typeof pitchingApproaches;
export const isPitchingApproach = (value: unknown): value is PitchingApproach =>
  typeof value === 'string' && Object.hasOwn(pitchingApproaches, value);
