'use client';
import { Search } from 'lucide-react';
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
            aria-label="선수 검색"
            title="선수 검색"
          >
            <Search size={18} />
            <span>선수 검색</span>
            <small>이름으로 찾기</small>
          </button>
        </DialogTrigger>
        <DialogContent className="player-search-dialog">
          <DialogHeader>
            <DialogTitle>선수 검색</DialogTitle>
            <DialogDescription>이름으로 선수를 찾아 상세 정보로 이동합니다.</DialogDescription>
          </DialogHeader>
          <label className="player-search-input">
            <Search size={20} />
            <input
              autoFocus
              type="search"
              aria-label="선수 이름"
              placeholder="선수 이름을 입력하세요"
              value={s.query}
              onChange={(e) => s.setQuery(e.target.value)}
            />
          </label>
          <small>
            {s.query.trim()
              ? `${s.count}명 검색됨${s.count > 30 ? ' · 이름을 더 입력해 범위를 좁혀 주세요.' : ''}`
              : '우리 팀 · 다른 리그 · 자유계약 선수'}
          </small>
          <div className="player-search-results">
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
                  {s.getClub(p.club)?.name || 'FA · 자유계약'} · {p.pos} · {p.age}세
                </span>
                <b>상세 →</b>
              </button>
            ))}
            {s.query.trim() && !s.count && <p>일치하는 선수가 없습니다.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
