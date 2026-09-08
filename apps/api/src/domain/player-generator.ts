import type { Player, RealSeed, Pos, League, Club } from '../../../../packages/shared/src/types';
import { blankStats, hash, rng, overall } from '../../../../packages/shared/src/game-view';
export function createPlayerGenerator(world: { clubs: Club[]; leagues: League[] }) {
  const getClub = (id: string) => world.clubs.find((c) => c.id === id)!;
  const getLeague = (id: string) => world.leagues.find((l) => l.id === id)!;
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const aliases: Record<string, string> = {
    'Shohei Ohtani': '오타니 쇼헤이',
    'Aaron Judge': '애런 저지',
    'Mookie Betts': '무키 베츠',
    'Freddie Freeman': '프레디 프리먼',
    'Yoshinobu Yamamoto': '야마모토 요시노부',
    'Roki Sasaki': '사사키 로키',
    'Jung Hoo Lee': '이정후',
    'Ha-Seong Kim': '김하성',
    'Hyeseong Kim': '김혜성',
    'Juan Soto': '후안 소토',
    'Bobby Witt Jr.': '바비 위트 주니어',
    'Paul Skenes': '폴 스킨스',
    'Tarik Skubal': '타릭 스쿠벌',
    'Shota Imanaga': '이마나가 쇼타',
    'Seiya Suzuki': '스즈키 세이야',
    'Yusei Kikuchi': '기쿠치 유세이',
    'Munetaka Murakami': '무라카미 무네타카',
    'Kazuma Okamoto': '오카모토 가즈마',
    'Teruaki Sato': '사토 데루아키',
    'Koji Chikamoto': '지카모토 고지',
    'Shota Morishita': '모리시타 쇼타',
    'Shosei Togo': '도고 쇼세이',
    'Hayato Sakamoto': '사카모토 하야토',
    'Yuki Yanagita': '야나기타 유키',
    'Kensuke Kondoh': '곤도 겐스케',
    'Chusei Mannami': '만나미 주세이',
    'Hiromi Itoh': '이토 히로미',
    'Hiroto Saiki': '사이키 히로토',
  };
  const families = ['김', '이', '박', '최', '정', '강', '윤', '장', '한', '임', '서', '신'];
  const firsts = [
    '지훈',
    '민재',
    '도현',
    '준서',
    '우진',
    '태윤',
    '시우',
    '현준',
    '도윤',
    '승현',
    '건우',
    '민준',
    '주원',
    '은호',
    '재민',
    '동현',
  ];
  function generatedName(country: string, r: () => number) {
    const pick = (a: string[]) => a[Math.floor(r() * a.length)];
    if (country === '대한민국') return pick(families) + pick(firsts);
    if (country === '일본')
      return (
        pick(['사토', '다나카', '스즈키', '야마모토', '이노우에', '와타나베']) +
        ' ' +
        pick(['하루토', '렌', '유토', '다이키', '쇼타', '타쿠미'])
      );
    if (country === '대만')
      return (
        pick(['린', '천', '왕', '장', '우', '류']) +
        ' ' +
        pick(['즈하오', '위천', '보위', '웨이팅', '쥔제', '위쉬엔'])
      );
    if (['도미니카공화국', '멕시코', '베네수엘라', '푸에르토리코'].includes(country))
      return (
        pick(['Luis', 'José', 'Carlos', 'Miguel', 'Rafael', 'Diego']) +
        ' ' +
        pick(['Pérez', 'García', 'Martínez', 'Rodríguez', 'Castro', 'López', 'Santos', 'Méndez'])
      );
    return (
      pick(['Alex', 'Lucas', 'Daniel', 'James', 'Noah', 'Liam', 'Marco', 'Tom']) +
      ' ' +
      pick(['Miller', 'Wilson', 'Novak', 'Rossi', 'de Vries', 'Taylor', 'Harris', 'Clark'])
    );
  }
  function makePlayer(club: string, index: number, real?: RealSeed, year = 2026): Player {
    const c = club === 'fa' ? null : getClub(club);
    const l = getLeague(c?.league || 'kbo');
    const r = rng(hash(`${club}:${index}:${real?.name || year}`));
    const country = real?.country || l.country;
    const name = real?.name || generatedName(country, r);
    const pos = (real?.pos ||
      [
        'C',
        'IF',
        'IF',
        'IF',
        'IF',
        'OF',
        'OF',
        'OF',
        'DH',
        'P',
        'P',
        'P',
        'P',
        'P',
        'P',
        'P',
        'C',
        'IF',
        'OF',
        'P',
        'P',
        'IF',
        'OF',
        'P',
        'P',
        'IF',
      ][index % 26]) as Pos;
    const base = real ? 50 : Math.round(l.level - 23 + r() * 23);
    const att = () => (real ? 50 : Math.round(clamp(base + (r() - 0.5) * 18, 28, 99)));
    const age = real ? real.age + year - 2026 : 18 + Math.floor(r() * 7);
    const p: Player = {
      id: real ? 'real-' + hash(real.name) : `${club}-gen-${year}-${index}`,
      name: aliases[name] || name,
      original: name,
      club,
      pos,
      age,
      real: !!real,
      country,
      number: real?.number ?? Math.floor(r() * 98) + 1,
      contact: att(),
      power: att(),
      speed: att(),
      field: att(),
      stuff: real ? 50 : pos === 'P' ? att() : Math.round(22 + r() * 25),
      control: real ? 50 : pos === 'P' ? att() : Math.round(25 + r() * 20),
      potential: real
        ? 50
        : clamp(base + (age < 25 ? 10 + Math.floor(r() * 15) : Math.floor(r() * 8)), base, 99),
      condition: 100,
      salary: 0,
      years: 1 + Math.floor(r() * 3),
      stats: blankStats(),
      source: real?.source,
      ageEstimated: real?.ageEstimated,
    };
    p.salary = Math.max(
      5,
      Math.round(Math.pow(overall(p) / 80, 5) * (real ? (l.id === 'mlb' ? 650 : 145) : 22)),
    );
    return p;
  }
  return { makePlayer, generatedName };
}
