import type { GameState, Result, WorldCatalog } from '@dugout/shared/types';
import { initialCards, cardTargetEligible } from '@dugout/shared/tactic-cards';
import { createGameView } from '@dugout/shared/game-view';
export function tacticCardAction(g: GameState, a: Record<string, unknown>, world: WorldCatalog) {
  if (!['drawInitialCards', 'armTacticCard', 'returnTacticCard'].includes(String(a.type)))
    return null;
  if (g.liveMatch || g.managerCareer?.status === 'unemployed' || g.managerCareer?.vacationUntil)
    throw new Error('소속 구단에서 경기 시작 전에 카드를 준비해 주세요.');
  if (a.type === 'drawInitialCards') {
    if (!g.tacticCards?.initialDrawn) g.tacticCards = initialCards(g.seed);
    return g;
  }
  const s = g.tacticCards;
  if (!s) throw new Error('먼저 시작 카드 5장을 받아 주세요.');
  if (a.type === 'returnTacticCard') {
    if (s.armed) {
      s.hand.push(s.armed.card);
      delete s.armed;
    }
    return g;
  }
  if (s.armed)
    throw new Error('한 경기에 한 장을 준비할 수 있습니다. 기존 카드를 회수한 뒤 선택하세요.');
  const card = s.hand.find((c) => c.id === a.id);
  if (!card) throw new Error('보유한 카드를 선택해 주세요.');
  const view = createGameView(world),
    p = view.marketPlayers(g).find((p) => p.id === a.target);
  if (
    !p ||
    p.club === g.club ||
    p.club === 'fa' ||
    !world.clubs.some((c) => c.id === p.club && c.league === view.getClub(g.club).league) ||
    !cardTargetEligible(card, p)
  )
    throw new Error('같은 리그 상대 구단의 카드 대상 선수를 선택해 주세요.');
  s.armed = { card, target: p.id, name: p.name, opponent: p.club };
  s.hand = s.hand.filter((c) => c.id !== card.id);
  return g;
}
export function consumeTacticCard(g: GameState, r: Result) {
  const s = g.tacticCards;
  if (r.friendly || !s?.armed || ![r.home, r.away].includes(s.armed.opponent)) return;
  const a = s.armed;
  s.used = [{ card: a.card, target: a.target, name: a.name, matchId: r.id }, ...s.used].slice(
    0,
    30,
  );
  delete s.armed;
}
