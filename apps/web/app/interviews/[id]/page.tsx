import Game from '../../../src/features/career/game-entry';
export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Game initialView="job-offers" initialOfferId={id} />;
}
