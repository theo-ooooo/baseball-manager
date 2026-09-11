'use client';
import { playerPosition } from '@dugout/shared/management';
import { Search } from 'lucide-react';
import { countryFlags } from '@dugout/shared/countries';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState, Player } from '@dugout/shared/types';
import { usePlayerSearch } from './use-player-search';

export function PlayerSearch({ g, onPlayer }: { g: GameState; onPlayer: (p: Player) => void }) {
  const s = usePlayerSearch(g);
  return (
    <>
      <Dialog open={s.open} onOpenChange={s.setOpen}>
        <DialogTrigger asChild>
          <button
            className="global-player-search"
            type="button"
            aria-label="통합 검색"
            title="통합 검색"
          >
            <Search size={18} />
            <span>통합 검색</span>
            <small>선수 · 감독 · 코치 · 국가</small>
          </button>
        </DialogTrigger>
        <DialogContent className="player-search-dialog">
          <DialogHeader>
            <DialogTitle>통합 검색</DialogTitle>
            <DialogDescription>
              선수·감독·코치·국가 이름으로 검색해 상세 정보를 확인합니다.
            </DialogDescription>
          </DialogHeader>
          <label className="player-search-input">
            <Search size={20} />
            <input
              autoFocus
              type="search"
              aria-label="선수·감독·코치·국가 이름"
              placeholder="선수, 감독, 코치 또는 국가 이름…"
              value={s.query}
              onChange={(e) => s.setQuery(e.target.value)}
            />
          </label>
          <small>
            {s.query.trim()
              ? `선수 ${s.count} · 감독 ${s.managerCount} · 코치 ${s.coachCount} · 국가 ${s.countries.length}개${s.count > 30 ? ' · 이름을 더 입력해 범위를 좁혀 주세요.' : ''}`
              : '이름이나 나라를 입력하세요. 예: 전준우, 염경엽, 대한민국'}
          </small>
          <div className="player-search-results">
            {s.countries.map((country) => (
              <button key={country} onClick={() => s.openCountry(country)}>
                <strong>
                  {countryFlags[country] || '🌐'} {country}
                </strong>
                <span>국가 · 대표팀 명단과 대회 일정</span>
                <b>국가 보기 →</b>
              </button>
            ))}
            {s.managers.map((p) => (
              <button key={`manager:${p.id}`} onClick={() => s.openManager(p.id)}>
                <strong>{p.name}</strong>
                <span>
                  {p.record?.role || '감독'} · {p.club ? s.getClub(p.club)?.name : '무직'}
                </span>
                <b>상세 →</b>
              </button>
            ))}
            {s.coaches.map(({ coach: c, club }) => (
              <button key={`coach:${c.id}`} onClick={() => s.openCoach(c.id)}>
                <strong>{c.name}</strong>
                <span>
                  {c.role} 코치 · {club === 'fa' ? '무소속' : s.getClub(club)?.name}
                </span>
                <b>상세 →</b>
              </button>
            ))}
            {s.retired.map((r) => (
              <button key={`retired:${r.playerId}`} onClick={() => s.openRetired(r.playerId)}>
                <strong>{r.name}</strong>
                <span>{r.year}년 현역 은퇴 · 선수 경력 보관</span>
                <b>인물 보기 →</b>
              </button>
            ))}
            {s.retiredError && <p role="alert">은퇴 인물 검색: {s.retiredError}</p>}
            {s.results.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  s.setOpen(false);
                  onPlayer(p);
                }}
              >
                <strong>{p.name}</strong>
                <span>
                  {s.getClub(p.club)?.name || 'FA · 자유계약'} · {playerPosition(p).label} · {p.age}
                  세
                </span>
                <b>상세 →</b>
              </button>
            ))}
            {s.query.trim() &&
              !s.count &&
              !s.countries.length &&
              !s.managerCount &&
              !s.retired.length &&
              !s.coachCount && <p>일치하는 인물이나 국가가 없습니다.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
