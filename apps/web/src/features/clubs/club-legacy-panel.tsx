'use client';
import Link from 'next/link';
import { Trophy, Bookmark, Star } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import { MAX_CLUB_MOMENTS } from '@dugout/shared/club-legacy';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
import { useClubLegacy } from './use-club-legacy';
export function ClubLegacyPanel({
  g,
  club,
  act,
  busy,
}: {
  g: GameState;
  club: string;
  act: Act;
  busy: boolean;
}) {
  const s = useClubLegacy(g, club, act, busy),
    { getClub } = useWorld(),
    titles = s.seasons.filter((x) => x.champion === club);
  return (
    <div className="club-legacy">
      <section className="legacy-trophy-room">
        <Trophy size={38} />
        <div>
          <small>우리 커리어의 역사</small>
          <h2>{getClub(club).name} 기록실</h2>
          <p>시즌이 끝나도, 감독이 팀을 옮겨도 이곳에 남습니다.</p>
        </div>
        <strong>
          {titles.length}
          <span>우승 트로피</span>
        </strong>
      </section>
      <section className="panel panel-content">
        <header className="legacy-section-heading">
          <div>
            <h2>
              <Bookmark size={20} /> 잊지 못할 경기
            </h2>
            <p>보관한 점수와 MVP는 다음 시즌에도 남습니다.</p>
          </div>
          {s.own && (
            <button
              className="button primary"
              disabled={s.locked || s.full || !s.choices.length}
              onClick={() => s.setOpen(true)}
            >
              {s.full ? `${MAX_CLUB_MOMENTS}경기 보관 중` : '기억할 경기 고르기'}
            </button>
          )}
        </header>
        {s.moments.length ? (
          <div className="legacy-moments">
            {s.moments.map((m) => (
              <article key={m.id}>
                <small>
                  {m.date}
                  {m.post ? ' · 포스트시즌' : ''}
                </small>
                <h3>{m.caption}</h3>
                <div className="legacy-score">
                  <span>{getClub(m.away).name}</span>
                  <b>
                    {m.awayScore} : {m.homeScore}
                  </b>
                  <span>{getClub(m.home).name}</span>
                </div>
                {m.mvp && <p>경기 MVP · {m.mvp}</p>}
                {s.own && (
                  <button
                    className="button secondary compact"
                    disabled={s.locked}
                    onClick={() => void s.remove(m.id)}
                  >
                    보관 해제
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="legacy-empty">
            끝내기 승리, 첫 승, 우승을 결정한 경기. 오래 기억할 경기를 골라두세요.
          </p>
        )}
      </section>
      <section className="panel panel-content">
        <header className="legacy-section-heading">
          <div>
            <h2>
              <Star size={20} /> 명예의 전당 · 시즌의 주역
            </h2>
            <p>
              시즌 종료 시점 소속 선수의 시즌 누적 기록을 보관합니다. 이적 전 기록도 포함됩니다.
            </p>
          </div>
        </header>
        {s.seasons.length ? (
          <div className="legacy-seasons">
            {s.seasons.map((y) => (
              <article key={y.year} className={y.champion === club ? 'champion' : ''}>
                <header>
                  <h3>{y.year} 시즌</h3>
                  <strong>{y.champion === club ? '🏆 최종 우승' : `정규시즌 ${y.rank}위`}</strong>
                </header>
                <p>
                  {y.w}승 {y.l}패 {y.d}무 · 감독 {y.manager}
                </p>
                <p>리그 우승 · {y.champion ? getClub(y.champion).name : '기록 없음'}</p>
                <div className="legacy-heroes">
                  {y.heroes.map((h) => (
                    <Link key={h.id} href={`/players/${encodeURIComponent(h.id)}`}>
                      <small>{h.role === 'bat' ? '타선의 주역' : '마운드의 주역'}</small>
                      <strong>{h.name} ↗</strong>
                      <span>{h.line}</span>
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="legacy-empty">
            이번 시즌을 마치면 성적표와 활약한 선수들이 첫 번째 기록을 채웁니다. 업데이트 이전에
            끝난 시즌은 소속과 선수 기록을 확인할 수 없어 새로 만들지 않습니다.
          </p>
        )}
      </section>
      <Dialog open={s.open} onOpenChange={s.setOpen}>
        <DialogContent className="legacy-dialog">
          <DialogHeader>
            <DialogTitle>기억할 경기 고르기</DialogTitle>
            <DialogDescription>
              구단별 {MAX_CLUB_MOMENTS}경기까지 보관합니다. 실제로 치른 경기의 점수와 MVP를
              보관합니다.
            </DialogDescription>
          </DialogHeader>
          <label>
            공식 경기
            <select
              aria-label="보관할 경기"
              value={s.selected}
              onChange={(e) => s.setSelected(e.target.value)}
              disabled={s.locked}
            >
              <option value="">경기를 선택하세요</option>
              {s.choices.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.date} · {getClub(r.away).name} {r.awayScore}:{r.homeScore}{' '}
                  {getClub(r.home).name}
                  {r.post ? ' · PS' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            이 경기를 기억할 한마디
            <input
              aria-label="보관 경기 제목"
              maxLength={80}
              value={s.caption}
              onChange={(e) => s.setCaption(e.target.value)}
              placeholder="예: 아홉 번의 위기, 마지막에 뒤집었다"
              disabled={s.locked}
            />
          </label>
          <button
            className="button primary"
            disabled={s.locked || !s.selected}
            onClick={() => void s.save()}
          >
            기록실에 보관
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
