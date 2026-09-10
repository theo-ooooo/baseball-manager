import Game from '../../../src/features/career/game';
export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Game initialClubId={id} />;
}
