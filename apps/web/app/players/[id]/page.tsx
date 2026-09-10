import Game from '../../../src/features/career/game-entry';

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  return <Game initialPlayerId={id} initialView={from || 'squad'} />;
}
