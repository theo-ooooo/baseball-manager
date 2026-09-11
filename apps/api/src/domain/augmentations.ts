import type { GameState, Result } from '@dugout/shared/types';
import { augmentationCatalog, type AugmentationKind } from '@dugout/shared/augmentations';
import { gameDate } from '@dugout/shared/calendar';
import { postNews } from './club-dynamics';
export function augmentationAction(g: GameState, a: Record<string, unknown>) {
  if (!['enableAugmentations', 'chooseAugmentation'].includes(String(a.type))) return null;
  if (g.liveMatch || g.managerCareer?.status === 'unemployed' || g.managerCareer?.vacationUntil)
    throw new Error('소속 구단에서 경기 시작 전에 증강을 선택해 주세요.');
  if (a.type === 'enableAugmentations') {
    if (g.augmentations?.enabled) return g;
    g.augmentations = { club: g.club, enabled: true, games: 0, credits: 1, history: [] };
    return g;
  }
  const s = g.augmentations;
  if (!s?.enabled || s.club !== g.club || s.credits < 1)
    throw new Error('사용할 수 있는 증강 선택권이 없습니다.');
  if (s.active && s.active.remaining > 0)
    throw new Error('현재 증강의 사용 기간이 끝난 뒤 다음 증강을 선택할 수 있습니다.');
  const kind = String(a.kind) as AugmentationKind;
  if (!Object.hasOwn(augmentationCatalog, kind)) throw new Error('선택할 증강을 확인해 주세요.');
  s.credits--;
  s.active = { kind, remaining: 5 };
  s.history = [{ kind, date: gameDate(g) }, ...s.history].slice(0, 30);
  postNews(
    g,
    `${augmentationCatalog[kind].name} 장착`,
    `${augmentationCatalog[kind].description}. 다음 공식 경기 5경기에 적용합니다. 연습경기는 제외합니다.`,
    'training',
    { actionView: 'augmentations' },
  );
  return g;
}
export function afterAugmentedMatch(g: GameState, r: Result) {
  const s = g.augmentations;
  if (!s?.enabled || s.club !== g.club || r.friendly || s.lastMatch === r.id) return;
  s.lastMatch = r.id;
  s.games++;
  if (s.active && --s.active.remaining <= 0) delete s.active;
  if (s.games % 8 === 0) {
    s.credits = Math.min(3, s.credits + 1);
    postNews(
      g,
      '증강 선택권 획득',
      `공식 경기 ${s.games}경기를 지휘했습니다. 증강 보관함에서 다음 보너스를 선택하세요.`,
      'training',
      { actionView: 'augmentations' },
    );
  }
}
