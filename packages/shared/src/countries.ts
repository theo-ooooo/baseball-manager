import type { League } from './types';
import { internationalCountries } from './international';
const aliases: Record<string, string> = {
  대한민국: '한국 코리아 South Korea KOR',
  일본: 'Japan JPN',
  미국: 'USA United States America',
  대만: 'Taiwan Chinese Taipei TPE',
  캐나다: 'Canada CAN',
  멕시코: 'Mexico MEX',
  도미니카공화국: '도미니카 Dominican Republic DOM',
  베네수엘라: 'Venezuela VEN',
  푸에르토리코: 'Puerto Rico PUR',
  네덜란드: 'Netherlands NED',
  이탈리아: 'Italy ITA',
  영국: 'UK Great Britain GBR',
  체코: 'Czechia Czech Republic CZE',
  호주: 'Australia AUS',
  쿠바: 'Cuba CUB',
  중국: 'China CHN',
  파나마: 'Panama PAN',
  콜롬비아: 'Colombia COL',
  브라질: 'Brazil BRA',
  니카라과: 'Nicaragua NCA',
  이스라엘: 'Israel ISR',
};
export const countryFlags: Record<string, string> = {
  대한민국: '🇰🇷',
  일본: '🇯🇵',
  미국: '🇺🇸',
  대만: '🇹🇼',
  캐나다: '🇨🇦',
  멕시코: '🇲🇽',
  도미니카공화국: '🇩🇴',
  베네수엘라: '🇻🇪',
  푸에르토리코: '🇵🇷',
  네덜란드: '🇳🇱',
  이탈리아: '🇮🇹',
  영국: '🇬🇧',
  체코: '🇨🇿',
  호주: '🇦🇺',
  쿠바: '🇨🇺',
  중국: '🇨🇳',
  파나마: '🇵🇦',
  콜롬비아: '🇨🇴',
  브라질: '🇧🇷',
  니카라과: '🇳🇮',
  이스라엘: '🇮🇱',
};
export const leagueCountries = (league: League) =>
  league.country.split(/[·/]/).map((c) => c.trim());
export const gameCountries = (leagues: League[]) => [
  ...new Set([...internationalCountries, '중국', ...leagues.flatMap(leagueCountries)]),
];
const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s/g, '');
export function searchCountries(query: string, countries: string[]) {
  const q = normalize(query);
  return q
    ? countries.filter((country) => normalize(`${country} ${aliases[country] || ''}`).includes(q))
    : [];
}
export const countryPath = (country: string) => `/countries/${encodeURIComponent(country)}`;
export const participatesInTournament = (country: string, kind: string) =>
  kind === 'asian'
    ? ['대한민국', '대만', '중국'].includes(country)
    : internationalCountries.includes(country);
