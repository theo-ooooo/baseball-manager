import Game from '../apps/web/game';

export default async function Page({ searchParams }: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <Game initialView={view} />;
}
