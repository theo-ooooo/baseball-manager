'use client';
import { useState } from 'react';
import type { GameState, Player } from '@dugout/shared/types';
import { playerAssessment } from '@dugout/shared/player-profile-view';
import { defensivePositions, familiarity } from '@dugout/shared/management';
export function usePlayerProfile(player: Player, game: GameState) {
  const [tab, setTab] = useState('overview');
  const own =
    game.managerCareer?.status !== 'unemployed' && game.roster.some((p) => p.id === player.id);
  const assessment = playerAssessment(player);
  const positions = defensivePositions
    .filter((pos) => (pos === 'P') === (player.pos === 'P'))
    .map((pos) => ({ pos, value: player.observation ? undefined : familiarity(player, pos) }));
  const ready = player.internationalDuty
    ? '국가대표 차출'
    : player.injury
      ? player.injury.phase === 'earlyReturn'
        ? '조기 복귀 · 관리 필요'
        : '부상 치료 중'
      : player.condition < 45
        ? '휴식 권장'
        : '출전 가능';
  return { tab, setTab, own, slot: game.lineup.indexOf(player.id), assessment, positions, ready };
}
