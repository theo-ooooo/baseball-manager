import type { Deal } from '@dugout/shared/types';
import { playerDealPeriod } from '@dugout/shared/contract-status';

export function PlayerContractPeriod({
  year,
  type,
  years,
}: {
  year: number;
  type: Deal['type'];
  years: number;
}) {
  const period = playerDealPeriod(year, type, years);
  return (
    <p className="rule-notice">
      {period.startYear}~{period.endYear} 시즌 · {years}년 계약
      {type === 'renew' && (
        <>
          . 올 시즌도 소속을 유지하며, 잔여 기간에는 올 시즌을 포함해 {period.remainingYears}
          시즌으로 표시합니다. 연봉은 체결 즉시 적용됩니다.
        </>
      )}
    </p>
  );
}
