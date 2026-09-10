import Game from '../src/features/career/game-entry';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; report?: string; target?: string; tab?: string }>;
}) {
  const { view, report, target, tab } = await searchParams;
  return (
    <Game
      initialView={view}
      initialReportId={report}
      initialTradeTarget={target}
      initialScoutTab={view === 'scouting' ? tab : undefined}
    />
  );
}
