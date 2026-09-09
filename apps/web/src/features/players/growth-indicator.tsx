import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { Player } from '@dugout/shared/types';
import {
  abilityChange,
  developmentBaseline,
  developmentChange,
  visibleChange,
} from '@dugout/shared/development';
import { isUnrated } from '@dugout/shared/ratings';
import { detailedAttributes } from '@dugout/shared/player-attributes';
import { Progress } from '@/components/ui/progress';

export function GrowthChange({
  delta,
  since,
  label = '능력',
  compact = false,
}: {
  delta: number | null;
  since?: string;
  label?: string;
  compact?: boolean;
}) {
  const value = visibleChange(delta);
  if (!value) return null;
  const rising = value > 0,
    Icon = rising ? ArrowUpRight : ArrowDownRight;
  const text = `${label} ${rising ? '상승' : '하락'} ${Math.abs(value).toFixed(2)}${since ? ` · ${since} 관찰 대비` : ''}`;
  return (
    <span
      className={`growth-delta ${rising ? 'is-up' : 'is-down'} ${compact ? 'compact' : ''}`}
      title={text}
      aria-label={text}
    >
      <Icon size={compact ? 13 : 15} aria-hidden="true" />
      <span aria-hidden="true">
        {rising ? '+' : ''}
        {value.toFixed(2)}
      </span>
    </span>
  );
}
export function PlayerGrowth({ player: p }: { player: Player }) {
  if (isUnrated(p)) return null;
  return (
    <GrowthChange
      delta={developmentChange(p)}
      since={developmentBaseline(p)?.date}
      label="종합 능력"
      compact
    />
  );
}
export function PlayerAttributes({ player: p, owned }: { player: Player; owned: boolean }) {
  const baseline = owned ? developmentBaseline(p) : null;
  const previous = baseline
    ? new Map(detailedAttributes({ ...p, ...baseline.abilities }).map((a) => [a.label, a.value]))
    : null;
  const attributes = detailedAttributes(p).map((a) => ({
    ...a,
    delta:
      baseline && a.value !== null && !isUnrated(p)
        ? a.key
          ? abilityChange(p, a.key)
          : previous?.get(a.label) != null
            ? a.value - previous.get(a.label)!
            : null
        : null,
  }));
  const rising = attributes.filter((a) => visibleChange(a.delta) > 0).length,
    falling = attributes.filter((a) => visibleChange(a.delta) < 0).length;
  return (
    <>
      {baseline && (
        <div className="attribute-growth-summary">
          <strong>최근 능력 변화</strong>
          <span>{baseline.date} 관찰 대비</span>
          {rising > 0 && <b className="is-up">↗ {rising}개 상승</b>}
          {falling > 0 && <b className="is-down">↘ {falling}개 하락</b>}
          {!rising && !falling && <span>아직 표시할 변화가 없습니다</span>}
        </div>
      )}
      <div className="attribute-grid">
        {attributes.map(({ label, key, value, basis, delta }) => (
          <div
            key={label}
            className={
              visibleChange(delta) > 0
                ? 'attribute-up'
                : visibleChange(delta) < 0
                  ? 'attribute-down'
                  : undefined
            }
          >
            <span>{label}</span>
            <div className="attribute-value">
              <strong>
                {p.observation
                  ? (key && p.observation.abilities?.[key]?.join('–')) || '?'
                  : (value ?? '미평가')}
              </strong>
              {baseline && <GrowthChange delta={delta} since={baseline.date} label={label} />}
            </div>
            <Progress value={value ?? 0} aria-label={`${label} ${value ?? '미평가'}`} />
            <small>{basis}</small>
          </div>
        ))}
      </div>
    </>
  );
}
