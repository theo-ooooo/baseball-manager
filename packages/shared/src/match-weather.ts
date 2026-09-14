import type { Club, Fixture, GameState } from './types';
import { gameDate } from './calendar';

export type MatchWeather = {
  sky: 'clear' | 'cloudy' | 'rain' | 'heavyRain';
  temperature: number;
  wind: number;
  rainfall: number;
  ground: 'dry' | 'damp' | 'waterlogged';
  covered: boolean;
  cancellation?: 'rain' | 'ground';
};
export type PostponedFixture = {
  fixture: Fixture;
  cancellations: { date: string; reason: 'rain' | 'ground'; weather: MatchWeather }[];
};
export type WeatherSeason = {
  version: 1;
  year: number;
  seed: number;
  fromDay: number;
  postponed: Record<string, PostponedFixture>;
};
export const weatherLabel = (weather: MatchWeather) =>
  weather.covered
    ? '지붕 아래 경기'
    : { clear: '맑음', cloudy: '흐림', rain: '비', heavyRain: '강한 비' }[weather.sky];
export const cancellationLabel = (reason: 'rain' | 'ground') =>
  reason === 'rain' ? '우천 취소' : '그라운드 사정 취소';

function sample(key: string) {
  let value = 2166136261;
  for (const char of key) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 4294967296;
}

/** Game-generated conditions: stable for the home venue and date, independent of match RNG. */
export function matchWeather(
  g: GameState,
  fixture: Pick<Fixture, 'home' | 'date'>,
  home?: Club,
): MatchWeather {
  const key = `${g.weather?.seed ?? g.year}:${fixture.home}:${fixture.date}`;
  const chance = sample(key + ':sky');
  const sky =
    chance < 0.58 ? 'clear' : chance < 0.82 ? 'cloudy' : chance < 0.975 ? 'rain' : 'heavyRain';
  const month = Number(fixture.date.slice(5, 7));
  const southern = home?.league === 'abl';
  const season = Math.cos(((month - (southern ? 1 : 7)) / 12) * Math.PI * 2);
  const tropical = ['lmp', 'lidom', 'lvbp', 'lbprc', 'cpbl'].includes(home?.league || '');
  const covered = home?.ballpark?.roof === 'covered';
  const rainfall =
    sky === 'heavyRain'
      ? 12 + Math.floor(sample(key + ':rain') * 20)
      : sky === 'rain'
        ? 1 + Math.floor(sample(key + ':rain') * 6)
        : 0;
  const ground = covered
    ? 'dry'
    : sky === 'heavyRain' || sample(key + ':ground') < 0.015
      ? 'waterlogged'
      : sky === 'rain'
        ? 'damp'
        : 'dry';
  return {
    sky,
    temperature: covered
      ? 23
      : Math.round((tropical ? 25 : 18 + season * 10) + sample(key + ':temp') * 8 - 4),
    wind: covered ? 0 : Math.round(sample(key + ':wind') * 7),
    rainfall: covered ? 0 : rainfall,
    ground,
    covered,
    ...(!covered && (sky === 'heavyRain' || ground === 'waterlogged')
      ? { cancellation: sky === 'heavyRain' ? ('rain' as const) : ('ground' as const) }
      : {}),
  };
}

export function canPlayWeather(g: GameState, fixture: Pick<Fixture, 'home' | 'date'>, home?: Club) {
  // Never cancel a game the user has already started or a legacy date before rollout.
  if (
    !g.weather ||
    g.weather.year !== g.year ||
    (g.liveMatch?.home === fixture.home &&
      (g.liveMatch.timeline?.date || gameDate(g)) === fixture.date)
  )
    return true;
  if (fixture.date < gameDate(g, g.weather.fromDay)) return true;
  return !matchWeather(g, fixture, home).cancellation;
}
