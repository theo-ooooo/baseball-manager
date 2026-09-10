import Game from '../src/features/career/game';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; report?: string; target?: string }>;
}) {
  const { view, report, target } = await searchParams;
  return <Game initialView={view} initialReportId={report} initialTradeTarget={target} />;
}
