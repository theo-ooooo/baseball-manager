import Game from '../../../src/features/career/game-entry';
export default async function CountryPage({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  return <Game initialCountry={country} />;
}
