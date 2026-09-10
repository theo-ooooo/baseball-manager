'use client';
import Link from 'next/link';
import { nav } from './game-navigation';

const groups = [
  {
    title: '선수단',
    items: [
      ['squad', '선수 명단'],
      ['reserves', '1군 · 2군'],
      ['registrations', '등록 · 말소'],
      ['training', '훈련'],
      ['tactics', '전술 · 타순'],
      ['medical', '의무'],
      ['dynamics', '분위기'],
    ],
  },
  {
    title: '선수 영입',
    items: [
      ['scouting', '스카우트'],
      ['market', '선수 시장'],
      ['agents', '계약 협상'],
      ['trade', '트레이드'],
      ['draft', '신인 선발'],
    ],
  },
  {
    title: '스태프',
    items: [
      ['staff', '코치진'],
      ['jobs', '채용 센터'],
      ['job-security', '직업 안정성'],
    ],
  },
  {
    title: '구단 운영',
    items: [
      ['vision', '구단 비전'],
      ['finance', '재정'],
    ],
  },
  {
    title: '리그',
    items: [
      ['world', '리그 · 선수 순위'],
      ['records', '통산 기록'],
      ['registrations', '등록 · 말소'],
    ],
  },
  {
    title: '감독',
    items: [
      ['manager', '내 프로필'],
      ['manager-contract', '계약 · 휴가'],
      ['manager-history', '경력'],
      ['job-offers', '받은 제안'],
      ['media', '인터뷰 · 팀 대화'],
    ],
  },
];

export function WorkspaceNavigation({
  view,
  unemployed,
  onView,
}: {
  view: string;
  unemployed: boolean;
  onView: (view: string) => void;
}) {
  if (['home', 'match', 'matchday', 'player', 'club'].includes(view)) return null;
  const group =
    unemployed && view === 'registrations'
      ? groups.find((g) => g.title === '리그')
      : groups.find((g) => g.items.some(([id]) => id === view));
  const items =
    group?.items.filter(([id]) => !(unemployed && ['staff', 'media'].includes(id))) || [];
  const title = group?.title || nav.find((n) => n.id === view)?.label;
  return (
    <div className="workspace-navigation">
      <h1>{title}</h1>
      {items.length > 0 && (
        <>
          <nav aria-label={`${title} 화면`}>
            {items.map(([id, label]) => (
              <Link
                key={id}
                href={id === 'job-offers' ? '/manager/offers' : `/?view=${id}`}
                aria-current={view === id ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <select
            className="workspace-section-select"
            aria-label={`${title} 화면 이동`}
            value={view}
            onChange={(e) => onView(e.target.value)}
          >
            {items.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
