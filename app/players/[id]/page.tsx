import Game from '../../../apps/web/game';

export default async function PlayerPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  return <Game initialPlayerId={id} initialView={from || 'squad'} />;
}
