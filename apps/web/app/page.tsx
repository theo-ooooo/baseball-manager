import Game from '../src/features/career/game-entry';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    report?: string;
    target?: string;
    tab?: string;
    mission?: string;
  }>;
}) {
  const { view, report, target, tab, mission } = await searchParams;
  return (
    <Game
      initialView={view}
      initialReportId={report}
      initialTradeTarget={target}
      initialScoutTab={view === 'scouting' ? tab : undefined}
      initialScoutMission={view === 'scouting' ? mission : undefined}
    />
  );
}
