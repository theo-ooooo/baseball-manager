import type { GameState } from './types';
export type ClubSeasonMemory = {
  club: string;
  year: number;
  manager: string;
  rank: number;
  w: number;
  l: number;
  d: number;
  champion: string;
  heroes: { id: string; name: string; role: 'bat' | 'pitch'; line: string }[];
};
export type ClubMoment = {
  id: string;
  club: string;
  date: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  mvp: string;
  post: boolean;
  caption: string;
};
export type ClubLegacy = { seasons: ClubSeasonMemory[]; moments: ClubMoment[] };
export const MAX_CLUB_MOMENTS = 12;
export function clubMemories(g: GameState, club: string) {
  return {
    seasons: (g.clubLegacy?.seasons || [])
      .filter((s) => s.club === club)
      .sort((a, b) => b.year - a.year),
    moments: (g.clubLegacy?.moments || [])
      .filter((m) => m.club === club)
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}
