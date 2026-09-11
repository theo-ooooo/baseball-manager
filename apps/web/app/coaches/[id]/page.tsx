import Game from '../../../src/features/career/game-entry';
export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Game initialCoachId={id} />;
}
