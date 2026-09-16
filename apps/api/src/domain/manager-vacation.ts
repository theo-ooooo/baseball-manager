import type { GameState } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';
import { postNews } from './club-dynamics';

export function finishManagerVacation(g: GameState, early = false) {
  const m = g.managerCareer!;
  const from =
    m.vacationStarted ||
    g.news.find((n) => n.title === '휴가 · 코치에게 경기 위임')?.date ||
    gameDate(g);
  delete m.vacationUntil;
  delete m.vacationStarted;
  postNews(
    g,
    early ? '휴가 조기 복귀 · 먼저 결정할 일' : '휴가 복귀 · 먼저 결정할 일',
    '감독님, 복귀하셨군요. 답변이 남은 일과 확인할 소식을 먼저 모았습니다. 경기 결과와 일반 보고는 아래에서 한 번에 살펴보세요.',
    'manager',
    {
      vacationSummary: { club: g.club, from, through: gameDate(g) },
      sender: { name: '코칭 스태프', role: '휴가 중 구단 업무 보고' },
    },
  );
}
