import type { GameState } from './types';
import { addDays } from './calendar';

export type InternationalTournament = {
  id: string;
  name: string;
  start: string;
  end: string;
  departure: string;
  returnDate: string;
  announce: string;
  kind: 'wbc' | 'asian' | 'olympic' | 'premier';
  estimated: boolean;
  source: string;
};
export type InternationalEvent = InternationalTournament & {
  players: string[];
  stage: 'selected' | 'away' | 'returned';
};
export type InternationalState = { events: InternationalEvent[] };
export type InternationalDuty = Pick<InternationalTournament, 'id' | 'name' | 'returnDate'>;

/** Published event dates; travel/camp windows and future recurrence are game assumptions. */
export function internationalCalendar(year: number): InternationalTournament[] {
  const events: InternationalTournament[] = [];
  function add(
    kind: InternationalTournament['kind'],
    name: string,
    from: string,
    to: string,
    estimated: boolean,
    source: string,
  ) {
    const start = `${year}-${from}`,
      end = `${year}-${to}`;
    events.push({
      id: `${kind}-${year}`,
      name,
      kind,
      start,
      end,
      estimated,
      source,
      announce: addDays(start, -10),
      departure: addDays(start, -3),
      returnDate: addDays(end, 2),
    });
  }
  if (year >= 2026 && (year - 2026) % 4 === 0) {
    add(
      'wbc',
      '월드 베이스볼 클래식',
      '03-05',
      '03-17',
      year !== 2026,
      'https://www.2026wbc.jp/schedule/',
    );
    add(
      'asian',
      '아시안게임',
      '09-21',
      '09-27',
      year !== 2026,
      'https://koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=11987',
    );
  }
  if (year >= 2027 && (year - 2027) % 4 === 0)
    add('premier', 'WBSC 프리미어12', '11-09', '11-24', true, 'https://www.wbsc.org/en/calendar');
  // Baseball is confirmed for LA28; do not assume its inclusion at every future Olympics.
  if (year === 2028)
    add(
      'olympic',
      'LA 올림픽',
      '07-13',
      '07-19',
      false,
      'https://la28.org/en/newsroom/la28-reveals-comprehensive-olympic-competition-schedule.html',
    );
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

const duties = new WeakMap<InternationalEvent[], Map<string, InternationalDuty>>();
export function internationalDutyFor(g: GameState, id: string) {
  const events = g.international?.events;
  if (!events) return undefined;
  let index = duties.get(events);
  if (!index) {
    index = new Map();
    for (const e of events)
      if (e.stage === 'away')
        for (const player of e.players)
          index.set(player, { id: e.id, name: e.name, returnDate: e.returnDate });
    duties.set(events, index);
  }
  return index.get(id);
}
