import Game from '../src/features/career/game';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; report?: string }>;
}) {
  const { view, report } = await searchParams;
  return <Game initialView={view} initialReportId={report} />;
}
