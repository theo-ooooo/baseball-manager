import Game from '../src/features/career/game';

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <Game initialView={view} />;
}
