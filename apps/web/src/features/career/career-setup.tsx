'use client';
import { useState, useMemo, type CSSProperties } from 'react';
import {
  Check,
  ChevronRight,
  CircleHelp,
  LoaderCircle,
  Shield,
  CircleDot as Baseball,
} from 'lucide-react';
import { useWorld } from './world-context';
import { overall, money, teamBudget } from '@dugout/shared/game-view';
import { Badge, Rating, Choice } from '../../components/game-ui';
import { Help } from './help-dialog';

export function NewCareer({
  loading,
  error,
  retry,
  busy,
  onStart,
  existing,
  cancel,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
  busy: boolean;
  onStart: (c: string, m: string, mode: string, ban: boolean, reveal: boolean) => void;
  existing: boolean;
  cancel: () => void;
}) {
  const { clubs, leagues, getClub, getLeague, baseRoster } = useWorld();
  const [lid, setLid] = useState('kbo'),
    [cid, setCid] = useState('kbo-lg'),
    [manager, setManager] = useState('강경원'),
    [region, setRegion] = useState('전체'),
    [mode, setMode] = useState('short'),
    [ban, setBan] = useState(false),
    [reveal, setReveal] = useState(false),
    [help, setHelp] = useState(false);
  const l = getLeague(lid),
    c = getClub(cid),
    roster = useMemo(() => baseRoster(cid), [cid, baseRoster]);
  const featured = [...roster].sort((a, b) => overall(b) - overall(a)).slice(0, 5);
  return (
    <div className="setup-page">
      <header className="setup-header">
        <div className="brand">
          <Baseball />
          <span>
            DUGOUT<i>BASEBALL MANAGEMENT</i>
          </span>
          <b className="edition-number">26</b>
        </div>
        <div className="setup-header-right">
          <span>새 커리어</span>
          <button className="icon-button" aria-label="게임 안내" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
          </button>
          {existing && (
            <button className="button secondary compact" onClick={cancel}>
              기존 커리어로
            </button>
          )}
        </div>
      </header>
      <main className="setup-main">
        <div className="setup-heading">
          <div>
            <h1>구단 선택</h1>
            <p>운영할 리그와 구단을 선택하세요.</p>
          </div>
          <div className="setup-steps">
            <span className="current">01 리그</span>
            <ChevronRight size={13} />
            <span>02 구단</span>
            <ChevronRight size={13} />
            <span>03 감독 취임</span>
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={retry}>다시 불러오기</button>
          </div>
        )}
        <div className="setup-grid">
          <section className="world-selector">
            <div className="selector-heading">
              <h2>리그</h2>
              <span>{leagues.length}개 대회</span>
            </div>
            <div className="region-filter">
              <Choice
                value={region}
                onChange={setRegion}
                label="대륙"
                items={['전체', '아시아', '아메리카', '유럽', '오세아니아'].map((t) => ({
                  value: t,
                  label: t === '전체' ? '모든 대륙' : t,
                }))}
              />
            </div>
            <div className="league-grid">
              {leagues
                .filter((v) => region === '전체' || v.region === region)
                .map((v) => (
                  <button
                    className={`league-card ${v.id === lid ? 'selected' : ''}`}
                    key={v.id}
                    aria-pressed={v.id === lid}
                    onClick={() => {
                      setLid(v.id);
                      setCid(clubs.find((c) => c.league === v.id)!.id);
                    }}
                  >
                    <span className="flag">{v.flag}</span>
                    <span>
                      <strong>{v.name}</strong>
                      <small>{v.country}</small>
                    </span>
                    <span className="league-count">
                      {clubs.filter((c) => c.league === v.id).length}
                    </span>
                    {v.id === lid && <Check size={13} />}
                  </button>
                ))}
            </div>
          </section>
          <section className="club-browser">
            <div className="selector-heading">
              <h2>{l.name}</h2>
              <span>
                {l.country} · {l.season}
              </span>
            </div>
            <div className="club-list-head">
              <span>구단</span>
              <span>연고지</span>
            </div>
            <div className="club-select-list">
              {clubs
                .filter((v) => v.league === lid)
                .map((v) => (
                  <button
                    key={v.id}
                    className={`club-option ${v.id === cid ? 'selected' : ''}`}
                    aria-pressed={v.id === cid}
                    onClick={() => setCid(v.id)}
                  >
                    <Badge club={v} size="small" />
                    <strong>{v.name}</strong>
                    <span className="club-city">{v.city}</span>
                    {v.id === cid && <Check size={14} />}
                  </button>
                ))}
            </div>
            <div className="database-note">
              <Shield size={15} />
              <span>실명·가상 선수 포함</span>
              <button className="text-button" onClick={() => setHelp(true)}>
                데이터 안내
                <ChevronRight size={13} />
              </button>
            </div>
          </section>
          <aside className="club-picker">
            <div className="chosen-club" style={{ '--club': c.color } as CSSProperties}>
              <Badge club={c} size="large" />
              <div>
                <small>{l.name}</small>
                <h2>{c.name}</h2>
                <span>{c.city}</span>
              </div>
            </div>
            <div className="club-facts">
              <div>
                <span>운영 예산</span>
                <strong>{money(teamBudget(lid))}</strong>
              </div>
              <div>
                <span>선수단</span>
                <strong>{roster.length}명</strong>
              </div>
              <div>
                <span>실명 선수</span>
                <strong>{roster.filter((p) => p.real).length}명</strong>
              </div>
            </div>
            <div className="key-players">
              <div className="selector-heading">
                <h2>주요 선수</h2>
                <span>능력</span>
              </div>
              {featured.map((p) => (
                <div className="setup-player" key={p.id}>
                  <span className="position-code">{p.pos}</span>
                  <span>
                    {p.name}
                    <small>
                      {p.real ? '실명' : '가상'} · {p.ageEstimated ? '게임 나이 ' : ''}
                      {p.age}세
                    </small>
                  </span>
                  <Rating value={overall(p)} player={p} />
                </div>
              ))}
            </div>
            <div className="career-fields">
              <label htmlFor="manager">
                감독 이름
                <input
                  id="manager"
                  maxLength={24}
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                />
              </label>
              <label>
                시즌 길이
                <Choice
                  value={mode}
                  onChange={setMode}
                  label="시즌 길이"
                  items={[
                    { value: 'short', label: '단축 · 상대별 2경기 / 2연전' },
                    { value: 'full', label: `정규 길이 · 약 ${l.games}경기` },
                  ]}
                />
              </label>
            </div>
            <div className="preseason-settings">
              <strong>프리시즌부터 시작 · 4주</strong>
              <p>연습경기 4회 · 전술 훈련 · 선수단 정비</p>
              <label>
                <input type="checkbox" checked={ban} onChange={(e) => setBan(e.target.checked)} />첫
                시즌 외부 선수 영입 금지
              </label>
              <small>FA 포함 · 재계약, 매각, 코치 선임 가능</small>
              <label>
                <input
                  type="checkbox"
                  checked={reveal}
                  onChange={(e) => setReveal(e.target.checked)}
                />
                잠재력 공개
              </label>
              <small>기본은 숨김 · 이 커리어를 시작한 뒤에는 변경할 수 없습니다.</small>
            </div>
            <button
              className="button primary start-button"
              disabled={busy || loading || !!error}
              onClick={() => onStart(cid, manager, mode, ban, reveal)}
            >
              {busy || loading ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <>
                  <span>{c.short} 감독으로 취임</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
            <p className="tiny text-center">경기와 계약은 자동 저장됩니다.</p>
          </aside>
        </div>
        <div className="setup-bottom">
          <span>2026 시즌 · {clubs.length}개 구단</span>
          <button className="text-button" onClick={() => setHelp(true)}>
            게임 규칙
          </button>
        </div>
      </main>
      <Help open={help} close={() => setHelp(false)} />
    </div>
  );
}
