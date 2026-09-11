'use client';
import type { GameState, Player } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { playerPosition } from '@dugout/shared/management';
import { playerPersonalityLabels } from '@dugout/shared/personality';
import { abilityText } from '@dugout/shared/ratings';
import { usePlayerProfile } from './use-player-profile';
const coordinates: Record<string, [number, number]> = {
  P: [50, 57],
  C: [50, 88],
  '1B': [76, 59],
  '2B': [64, 39],
  '3B': [24, 59],
  SS: [36, 39],
  LF: [20, 22],
  CF: [50, 12],
  RF: [80, 22],
  DH: [84, 85],
};
export function PlayerOverview({
  player: p,
  game: g,
  profile: v,
}: {
  player: Player;
  game: GameState;
  profile: ReturnType<typeof usePlayerProfile>;
}) {
  const stats = p.stats,
    pitcher = p.pos === 'P',
    recent = p.mood?.recent || [];
  const facts = pitcher
    ? [
        ['등판', stats.g],
        ['이닝', `${Math.floor(stats.outs / 3)}.${stats.outs % 3}`],
        ['평균자책', stats.outs ? ((stats.er * 27) / stats.outs).toFixed(2) : '—'],
        ['탈삼진', stats.k],
        ['승리', stats.wins],
        ['세이브', stats.saves ?? '—'],
      ]
    : [
        ['경기', stats.g],
        ['타율', stats.ab ? (stats.h / stats.ab).toFixed(3) : '—'],
        ['홈런', stats.hr],
        ['타점', stats.rbi],
        ['볼넷', stats.bb],
        ['도루', stats.sb ?? '—'],
      ];
  return (
    <div className="player-overview">
      <div className="player-overview-main">
        <section className="dossier-card player-position-card">
          <header>
            <h2>포지션 · 기용</h2>
            <span>{playerPosition(p).label}</span>
          </header>
          <div className="player-position-map" aria-label="게임 내 수비 포지션 적합도">
            <div className="position-diamond" />
            {v.positions.map(({ pos, value }) => {
              const xy = coordinates[pos];
              return xy ? (
                <span
                  key={pos}
                  className={`position-dot ${value !== undefined && value >= 70 ? 'familiar' : ''}`}
                  style={{ left: `${xy[0]}%`, top: `${xy[1]}%` }}
                  title={`${pos} ${value === undefined ? '관찰 필요' : Math.round(value) + '%'}`}
                >
                  {pos}
                </span>
              ) : null;
            })}
          </div>
          <div className="position-summary">
            {v.positions
              .filter((p) => p.value !== undefined && p.value >= 70)
              .sort((a, b) => b.value! - a.value!)
              .slice(0, 3)
              .map((p) => (
                <span key={p.pos}>
                  {p.pos} <strong>{Math.round(p.value!)}%</strong>
                </span>
              ))}
          </div>
          <p>
            {v.own
              ? v.slot >= 0
                ? `현재 ${v.slot + 1}번 타순 등록`
                : p.pos === 'P'
                  ? '투수진 기용 계획 확인'
                  : '타순 미등록 · 벤치 대기'
              : p.observation
                ? '포지션 세부 평가는 관찰이 필요합니다.'
                : '현재 구단의 선수단 정보'}
          </p>
          <button className="text-button" onClick={() => v.setTab('profile')}>
            역할과 세부 능력 보기 →
          </button>
        </section>
        <section className="dossier-card player-attribute-card">
          <header>
            <h2>능력 개요</h2>
            <span>{p.observation ? '관찰 평가' : '게임 평가'}</span>
          </header>
          <div className="compact-attributes">
            {v.assessment.attributes.map((a) => (
              <div
                key={a.label}
                className={a.value !== null && a.value >= 80 ? 'strong-attribute' : ''}
              >
                <span>{a.label}</span>
                <strong>{a.text}</strong>
              </div>
            ))}
          </div>
          <p className="profile-overview-note">{v.assessment.basis}</p>
        </section>
        <section className="dossier-card player-readiness-card">
          <header>
            <h2>몸 상태 · 사기</h2>
            <span className="dossier-badge">{v.ready}</span>
          </header>
          <div className="readiness-meter">
            <span>
              컨디션 <strong>{abilityText(p.condition)}%</strong>
            </span>
            <progress value={p.condition} max={100} aria-label="선수 컨디션" />
          </div>
          {p.mood && (
            <div className="readiness-meter">
              <span>
                사기 <strong>{abilityText(p.mood.value)} / 100</strong>
              </span>
              <progress value={p.mood.value} max={100} aria-label="선수 사기" />
              <p>{p.mood.reason}</p>
            </div>
          )}
          {p.injury && (
            <p className="profile-overview-alert">
              {p.injury.name} · {p.injury.returnDate} 복귀 예정
            </p>
          )}
          {p.internationalDuty && (
            <p className="profile-overview-alert">
              {p.internationalDuty.name} · {p.internationalDuty.returnDate} 구단 복귀
            </p>
          )}
          {recent.length > 0 && (
            <div className="recent-appearances">
              <small>
                최근 {recent.length}경기 중 {recent.filter(Boolean).length}경기 출전
              </small>
              <div
                role="img"
                aria-label={recent.map((played) => (played ? '출전' : '미출전')).join(', ')}
              >
                {recent.slice(-12).map((played, i) => (
                  <i key={i} className={played ? 'played' : ''} />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      <div className="player-overview-bottom">
        <section className="dossier-card">
          <header>
            <h2>선수 평가 · 성향</h2>
          </header>
          {v.assessment.strengths.length ? (
            <>
              <p>
                <b className="assessment-positive">강점</b>
                {v.assessment.strengths.map((a) => `${a.label} ${a.text}`).join(' · ')}
              </p>
              <p>
                <b className="assessment-concern">보완 후보</b>
                {v.assessment.concern
                  ? `${v.assessment.concern.label} ${v.assessment.concern.text}`
                  : '확인된 평가에서 뚜렷한 약점 없음'}
              </p>
            </>
          ) : (
            <p>강점과 약점을 판단할 관찰 정보가 부족합니다.</p>
          )}
          <small className="profile-overview-note">현재 확인 가능한 능력 간 비교입니다.</small>
          <div className="player-personality-tags">
            {playerPersonalityLabels(p).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <small className="profile-overview-note">
            실제 성격과 별개인 게임 내 성향 · 계약과 트레이드 반응에 반영
          </small>
          <button
            className="text-button"
            onClick={() =>
              v.setTab(
                v.own
                  ? 'development'
                  : g.managerCareer?.status === 'unemployed'
                    ? 'profile'
                    : 'scouting',
              )
            }
          >
            {v.own ? '성장 · 훈련 보기' : '관찰 정보 보기'} →
          </button>
        </section>
        <section className="dossier-card">
          <header>
            <h2>계약 · 가치</h2>
          </header>
          <dl className="dossier-facts">
            <div>
              <dt>연봉</dt>
              <dd>{money(p.salary)}</dd>
            </div>
            <div>
              <dt>잔여 계약</dt>
              <dd>{p.years}년</dd>
            </div>
            <div>
              <dt>시장 가치</dt>
              <dd>{p.marketValue === undefined ? '미평가' : money(p.marketValue)}</dd>
            </div>
            <div>
              <dt>선수단</dt>
              <dd>{p.club === 'fa' ? 'FA · 자유계약' : p.squad === 'reserve' ? '2군' : '1군'}</dd>
            </div>
          </dl>
          <button className="text-button" onClick={() => v.setTab('contract')}>
            계약 상세 보기 →
          </button>
        </section>
        <section className="dossier-card player-season-card">
          <header>
            <h2>{g.year} 시즌 핵심 기록</h2>
            <button className="text-button" onClick={() => v.setTab('records')}>
              전체 성적 →
            </button>
          </header>
          <dl className="player-stat-tiles">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <small className="profile-overview-note">
            게임 내 1군 기록 · 이전 기록은 성적 탭에서 확인
          </small>
        </section>
      </div>
    </div>
  );
}
