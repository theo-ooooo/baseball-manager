'use client';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GameState } from '@dugout/shared/types';
import { countryFlags } from '@dugout/shared/countries';
import { playerPosition } from '@dugout/shared/management';
import { ratingText } from '@dugout/shared/ratings';
import { InternationalTeamsContent } from '../schedule/international-teams-panel';
import { InternationalCalendarPanel } from '../schedule/international-calendar-panel';
import { PlayerPortrait } from '../players/player-portrait';
import { useCountryProfile } from './use-country-profile';
export function CountryProfile({ g, country }: { g: GameState; country: string }) {
  const p = useCountryProfile(g, country),
    { teams } = p;
  if (!p.known)
    return (
      <section className="panel">
        <h1>국가를 찾을 수 없습니다</h1>
        <p>통합 검색에 나라 이름을 입력해 다시 찾아 주세요.</p>
      </section>
    );
  const stage =
    teams.selection?.stage === 'away'
      ? '국제대회 참가 중'
      : teams.selection?.stage === 'returned'
        ? '구단 복귀 완료'
        : teams.selection
          ? '명단 발표 완료'
          : '명단 발표 전';
  return (
    <article className="country-dossier">
      <header className="country-dossier-header">
        <div className="country-identity">
          <span className="country-flag" aria-hidden="true">
            {countryFlags[country] || '🌐'}
          </span>
          <div>
            <span className="country-kicker">NATION PROFILE {p.region ? `· ${p.region}` : ''}</span>
            <h1>{country}</h1>
            <p>야구 국가 정보 · {g.year} 시즌</p>
          </div>
        </div>
        <dl className="country-headline-stats">
          <div>
            <dt>국가대표</dt>
            <dd>
              {teams.players.length}
              <small>명</small>
            </dd>
          </div>
          <div>
            <dt>국내 리그</dt>
            <dd>
              {p.domestic.length}
              <small>개</small>
            </dd>
          </div>
          <div>
            <dt>등록 선수</dt>
            <dd>
              {p.pool.length}
              <small>명</small>
            </dd>
          </div>
        </dl>
      </header>
      <Tabs value={p.tab} onValueChange={p.setTab}>
        <TabsList className="dossier-tabs" variant="line">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="squad">국가대표</TabsTrigger>
          <TabsTrigger value="events">국제대회</TabsTrigger>
          <TabsTrigger value="leagues">국내 리그</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="country-overview-grid">
            <section className="dossier-card country-team-card">
              <header>
                <h2>국가대표 현황</h2>
                <span className="dossier-badge">{stage}</span>
              </header>
              <div className="country-team-feature">
                <span className="country-emblem" aria-hidden="true">
                  {countryFlags[country] || '🌐'}
                </span>
                <div>
                  <small>현재 대표팀 일정</small>
                  <h3>{teams.event?.name || '편성된 대회 없음'}</h3>
                  <p>
                    {teams.event
                      ? `${teams.event.start} ~ ${teams.event.end}`
                      : '국제대회 일정이 편성되면 표시합니다.'}
                  </p>
                </div>
              </div>
              <dl className="dossier-facts">
                <div>
                  <dt>선발 명단</dt>
                  <dd>{teams.players.length}명</dd>
                </div>
                <div>
                  <dt>평균 연령</dt>
                  <dd>{p.averageAge ? p.averageAge.toFixed(1) + '세' : '—'}</dd>
                </div>
                <div>
                  <dt>투수 / 야수</dt>
                  <dd>
                    {teams.players.filter((p) => p.pos === 'P').length} /{' '}
                    {teams.players.filter((p) => p.pos !== 'P').length}
                  </dd>
                </div>
                <div>
                  <dt>구단 복귀</dt>
                  <dd>{teams.event?.returnDate || '—'}</dd>
                </div>
              </dl>
              <button className="button primary" onClick={() => p.setTab('squad')}>
                대표팀 선수 살펴보기 →
              </button>
            </section>
            <section className="dossier-card">
              <header>
                <h2>주목할 선수</h2>
                <span>확인 가능한 평가 기준</span>
              </header>
              <div className="country-notable-players">
                {p.notable.map((player) => (
                  <Link key={player.id} href={`/players/${encodeURIComponent(player.id)}`}>
                    <PlayerPortrait player={player} />
                    <div>
                      <strong>{player.name}</strong>
                      <small>
                        {p.getClub(player.club)?.name || 'FA'} · {playerPosition(player).label} ·{' '}
                        {player.age}세
                      </small>
                    </div>
                    <b>{ratingText(player)}</b>
                  </Link>
                ))}
              </div>
              {!p.notable.length && <p>등록된 선수 정보가 없습니다.</p>}
            </section>
            <section className="dossier-card">
              <header>
                <h2>국내 야구</h2>
                <span>{p.clubs.length}개 구단</span>
              </header>
              <div className="country-league-summary">
                {p.domestic.map((league) => {
                  const table = p.standings(g, league.id),
                    played = table.some((r) => r.w + r.l + r.d > 0);
                  return (
                    <div key={league.id}>
                      <strong>{league.name}</strong>
                      <p>
                        {league.label} · {p.clubs.filter((c) => c.league === league.id).length}개
                        구단
                      </p>
                      <small>
                        {played
                          ? `현재 선두 · ${p.getClub(table[0].club).name}`
                          : '정규시즌 성적 집계 전'}
                      </small>
                    </div>
                  );
                })}
              </div>
              {!p.domestic.length && <p>게임에 등록된 국내 리그가 없습니다.</p>}
              <button className="text-button" onClick={() => p.setTab('leagues')}>
                리그와 구단 전체 보기 →
              </button>
            </section>
            <section className="dossier-card">
              <header>
                <h2>국제대회 일정</h2>
                <span>{teams.events.length}개 대회</span>
              </header>
              <div className="country-event-timeline">
                {teams.events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      teams.setEventId(event.id);
                      p.setTab('squad');
                    }}
                  >
                    <span>{event.start.slice(5).replace('-', '.')}</span>
                    <div>
                      <strong>{event.name}</strong>
                      <small>
                        {event.start} ~ {event.end}
                      </small>
                    </div>
                    <b>→</b>
                  </button>
                ))}
              </div>
              {!teams.events.length && <p>이 국가의 대회 일정이 없습니다.</p>}
            </section>
          </div>
        </TabsContent>
        <TabsContent value="squad">
          <InternationalTeamsContent teams={teams} fixedCountry={country} />
        </TabsContent>
        <TabsContent value="events">
          <InternationalCalendarPanel g={g} country={country} />
        </TabsContent>
        <TabsContent value="leagues">
          <section className="dossier-card">
            <header>
              <h2>리그와 구단</h2>
              <span>
                {p.domestic.length}개 리그 · {p.clubs.length}개 구단
              </span>
            </header>
            {p.domestic.map((league) => (
              <div className="country-league" key={league.id}>
                <h3>{league.name}</h3>
                <div>
                  {p.clubs
                    .filter((c) => c.league === league.id)
                    .map((club) => (
                      <Link key={club.id} href={`/clubs/${encodeURIComponent(club.id)}`}>
                        {club.name}
                      </Link>
                    ))}
                </div>
              </div>
            ))}
            {!p.domestic.length && <p>게임에 등록된 국내 리그가 없습니다.</p>}
          </section>
        </TabsContent>
      </Tabs>
    </article>
  );
}
