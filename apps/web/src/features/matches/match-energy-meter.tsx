'use client';
export function MatchEnergyMeter({
  value,
  condition,
  compact = false,
}: {
  value?: number;
  condition: number;
  compact?: boolean;
}) {
  const current = Math.round(value ?? condition);
  return (
    <div
      className={`match-energy-meter ${current < 40 ? 'exhausted' : current < 60 ? 'tired' : ''} ${compact ? 'compact' : ''}`}
    >
      <div>
        <span>{value === undefined ? '경기 전 컨디션' : '경기 체력'}</span>
        <b>{current}%</b>
      </div>
      <meter
        min="0"
        max="100"
        low={40}
        high={60}
        optimum={100}
        value={current}
        aria-label={value === undefined ? '경기 전 컨디션' : '경기 체력'}
      />
      {!compact && (
        <small>
          경기 전 컨디션 {Math.round(condition)}%
          {value === undefined
            ? ' · 이전 경기에는 체력 기록이 없습니다.'
            : ' · 투구·타격·주루에 따라 감소'}
        </small>
      )}
    </div>
  );
}
