import type { Player } from './types';

/** Local default image shown when no verified official photo exists or it fails to load. */
export const PLAYER_SILHOUETTE = '/images/player-silhouette.svg';

export type PortraitLeague = 'mlb' | 'kbo';

export type PlayerPortraitSource = {
  league: PortraitLeague;
  officialId: string;
  /** Official image URL derived from the verified official identifier. */
  url: string;
  /** Official page that carries the identifier and photo. */
  sourcePage: string;
};

const numeric = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

/**
 * Official image URL patterns verified on 2026-09-09.
 * MLB: img.mlbstatic.com headshot for a MLB Stats API person id (used by mlb.com player pages).
 * KBO: koreabaseball.com player detail pages embed KBO_IMAGE/person/middle/{year}/{playerId}.jpg.
 * NPB photos (p.npb.jp/players_photo/...) carry a per-club prefix that cannot be derived from
 * the player id alone, so they are intentionally not built here.
 */
export function officialPortraitUrl(league: PortraitLeague, officialId: string, year = 2026) {
  if (!numeric(officialId)) return null;
  if (league === 'mlb')
    return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_auto:best/v1/people/${officialId}/headshot/67/current`;
  if (league === 'kbo')
    return `https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle/${year}/${officialId}.jpg`;
  return null;
}

export function officialPortraitPage(league: PortraitLeague, officialId: string) {
  return league === 'mlb'
    ? `https://www.mlb.com/player/${officialId}`
    : `https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx?playerId=${officialId}`;
}

/**
 * Resolve a verified official photo for a real player.
 * 1) `portrait` metadata loaded from D1 (KBO ids matched on club, name and number).
 * 2) Otherwise the MLB Stats API person id on the graded performance record, which already
 *    backs the displayed rating, so no name guessing is involved.
 */
export function officialPortrait(
  player: Pick<Player, 'real'> & { rating?: Player['rating']; portrait?: Player['portrait'] },
): PlayerPortraitSource | null {
  if (!player.real) return null;
  // D1 catalog metadata (KBO player ids verified against the official search listing) wins.
  const stored = player.portrait;
  if (stored && numeric(stored.officialId) && /^https:\/\//.test(stored.url))
    return {
      league: stored.league,
      officialId: stored.officialId,
      url: stored.url,
      sourcePage: stored.source || officialPortraitPage(stored.league, stored.officialId),
    };
  const record = player.rating?.record;
  if (!record || record.league !== 'mlb' || !numeric(record.officialId)) return null;
  const url = officialPortraitUrl('mlb', record.officialId);
  if (!url) return null;
  return {
    league: 'mlb',
    officialId: record.officialId,
    url,
    sourcePage: officialPortraitPage('mlb', record.officialId),
  };
}
