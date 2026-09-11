import Game from '../../../src/features/career/game-entry';
export default async function ManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Game initialManagerId={id} />;
}
