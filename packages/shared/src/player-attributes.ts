import type { AbilityKey, Player } from '@dugout/shared/types';
import { isUnrated } from '@dugout/shared/ratings';
const clamp = (n: number) => Math.round(Math.max(20, Math.min(99, n)));
export function battingProfile(p: Player) {
  const r = p.rating?.record,
    pa = r?.pa || 0,
    ab = r?.ab || 0,
    reliability = pa / (pa + 150);
  const observedOBP =
    r?.obp ??
    (r && ab && r.bb !== undefined
      ? ((r.h || 0) + r.bb + (r.hbp || 0)) / (ab + r.bb + (r.hbp || 0) + (r.sf || 0))
      : undefined);
  const obp =
    observedOBP === undefined
      ? 0.3 + (p.contact - 60) * 0.0015
      : 0.32 + (observedOBP - 0.32) * reliability;
  const slg = r && ab ? 0.4 + ((r.tb || 0) / ab - 0.4) * reliability : 0.4 + (p.power - 60) * 0.006;
  return {
    obp,
    slg,
    contact: p.contact,
    speed: p.speed,
    gdp: r?.gdp === undefined ? 0 : r.gdp / Math.max(1, pa),
    observedOBP,
  };
}
export type DetailedAttribute = {
  label: string;
  value: number | null;
  basis: string;
  key?: AbilityKey;
};
export function detailedAttributes(p: Player): DetailedAttribute[] {
  const r = p.rating?.record,
    unknown = isUnrated(p),
    sample = p.pos === 'P' ? (r?.outs || 0) / 3 : r?.pa || 0,
    weight = sample / (sample + (p.pos === 'P' ? 35 : 150));
  const grade = (value: number, neutral: number, scale: number) =>
    clamp(65 + (value - neutral) * scale * weight);
  const primary = (label: string, key: AbilityKey) => ({
    label,
    key,
    value:
      unknown || (p.real && p.rating?.estimatedAttributes.includes(label))
        ? null
        : Math.round(p[key]),
    basis: '종합 능력',
  });
  const rows =
    p.pos === 'P'
      ? [
          primary('구위', 'stuff'),
          primary('제구', 'control'),
          {
            label: '탈삼진',
            value:
              r?.outs && r.k !== undefined
                ? grade((r.k * 27) / r.outs, 8, 6)
                : p.real
                  ? null
                  : clamp(p.stuff * 0.8 + p.control * 0.2),
            basis: 'K/9',
          },
          {
            label: '볼넷 억제',
            value:
              r?.outs && r.bb !== undefined
                ? grade((r.bb * 27) / r.outs, 3.2, -10)
                : p.real
                  ? null
                  : p.control,
            basis: 'BB/9',
          },
          {
            label: '피홈런 억제',
            value:
              r?.outs && r.hr !== undefined
                ? grade((r.hr * 27) / r.outs, 1, -20)
                : p.real
                  ? null
                  : clamp(p.stuff * 0.6 + p.control * 0.4),
            basis: 'HR/9',
          },
          {
            label: '실점 억제',
            value:
              r?.outs && r.er !== undefined
                ? grade((r.er * 27) / r.outs, 4, -8)
                : p.real
                  ? null
                  : clamp(p.stuff * 0.5 + p.control * 0.5),
            basis: 'ERA',
          },
          {
            label: '이닝 소화',
            value:
              r?.outs && r.g
                ? clamp(35 + (r.outs / 3 / r.g) * 8)
                : p.real
                  ? null
                  : clamp(p.stuff * 0.7 + p.control * 0.3),
            basis: '등판당 이닝',
          },
          primary('수비', 'field'),
          { label: '구종·구속', value: null, basis: '측정 자료 미확인' },
        ]
      : [
          primary('컨택', 'contact'),
          primary('파워', 'power'),
          {
            label: '선구안',
            value:
              r?.pa && r.bb !== undefined
                ? grade(r.bb / r.pa, 0.085, 280)
                : p.real
                  ? null
                  : clamp(p.contact * 0.65 + p.power * 0.35),
            basis: 'BB/PA',
          },
          {
            label: '삼진 회피',
            value:
              r?.pa && r.k !== undefined
                ? grade(r.k / r.pa, 0.21, -150)
                : p.real
                  ? null
                  : p.contact,
            basis: 'SO/PA',
          },
          {
            label: '출루',
            value:
              battingProfile(p).observedOBP !== undefined
                ? grade(battingProfile(p).observedOBP!, 0.32, 280)
                : p.real
                  ? null
                  : clamp(p.contact * 0.8 + p.speed * 0.2),
            basis: 'OBP',
          },
          {
            label: '장타 생산',
            value:
              r?.ab && r.tb !== undefined
                ? grade((r.tb - (r.h || 0)) / r.ab, 0.15, 180)
                : p.real
                  ? null
                  : p.power,
            basis: 'ISO',
          },
          primary('주력', 'speed'),
          {
            label: '도루 판단',
            value:
              r?.sb !== undefined && r.cs !== undefined && r.sb + r.cs > 0
                ? clamp(50 + (r.sb / (r.sb + r.cs) - 0.65) * 90)
                : p.real
                  ? null
                  : clamp(p.speed * 0.75 + p.contact * 0.25),
            basis: '도루 성공률',
          },
          primary('수비', 'field'),
          {
            label: '송구',
            value: p.real ? null : p.field,
            basis: p.real ? '측정 자료 미확인' : '게임 능력',
          },
        ];
  return p.observation
    ? rows.map((row) => ({
        ...row,
        value: null,
        basis: p.observation!.status === 'unknown' ? '관찰 필요' : '스카우트 관찰',
      }))
    : rows;
}
export function lineupReason(p: Player, slot: number) {
  const profile = battingProfile(p);
  const role =
    [
      '출루·주루',
      '출루·득점 생산',
      '컨택·장타',
      '장타·득점 생산',
      '장타 지원',
      '타선 연결',
      '타선 연결',
      '하위 타선',
      '출루·주루 연결',
    ][slot] || '타선 연결';
  return `${role} · ${profile.observedOBP === undefined ? '출루 자료 미확인' : `OBP ${profile.observedOBP.toFixed(3)}`} · ${p.real && p.rating?.estimatedAttributes.includes('주력') ? '주력 미평가' : `주력 ${Math.round(p.speed)}`}`;
}
