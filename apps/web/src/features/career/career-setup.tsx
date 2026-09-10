'use client';
import { useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  LoaderCircle,
  CircleDot as Baseball,
} from 'lucide-react';
import { useWorld } from './world-context';
import { overall, money, teamBudget } from '@dugout/shared/game-view';
import { Badge, Rating } from '../../components/game-ui';
import { Help } from './help-dialog';

const regions = ['전체', '아시아', '아메리카', '유럽', '오세아니아'];
const DEFAULT_MANAGER = '신임 감독';

export type CareerStartOptions = {
  club: string;
  manager: string;
  mode: string;
  firstSeasonTransferBan: boolean;
  revealPotential: boolean;
  unemployed: boolean;
  /** false opens the career on the league's first fixture date instead of four weeks earlier. */
  preseason: boolean;
};

const seasonStartOptions = [
  {
    value: true,
    icon: '🏕',
    title: '프리시즌 4주부터 시작',
    desc: '연습경기 4회 · 전술 훈련 · 선수단 정비 후 개막',
    tag: '기본',
  },
  {
    value: false,
    icon: '🎉',
    title: '정규시즌 개막부터 시작',
    desc: '프리시즌 없이 개막전에서 바로 지휘 · 다음 시즌도 개막일 시작',
    tag: '빠른 시작',
  },
];

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
  onStart: (options: CareerStartOptions) => void;
  existing: boolean;
  cancel: () => void;
}) {
  const { clubs, leagues, getClub, getLeague, baseRoster } = useWorld();
  const [step, setStep] = useState<'club' | 'manager'>('club'),
    [unemployed, setUnemployed] = useState(false),
    [region, setRegion] = useState('전체'),
    [lid, setLid] = useState('kbo'),
    [cid, setCid] = useState('kbo-lg'),
    [manager, setManager] = useState(''),
    [mode, setMode] = useState('short'),
    [ban, setBan] = useState(false),
    [preseason, setPreseason] = useState(true),
    [reveal, setReveal] = useState(false),
    [showPlayers, setShowPlayers] = useState(false),
    [help, setHelp] = useState(false);
  const league = getLeague(lid),
    club = getClub(cid),
    roster = baseRoster(cid),
    featured = [...roster].sort((a, b) => overall(b) - overall(a)).slice(0, 5),
    leagueClubs = clubs.filter((c) => c.league === lid),
    visibleLeagues = leagues.filter((v) => region === '전체' || v.region === region),
    disabled = busy || loading || !!error;
  const pickLeague = (id: string) => {
    setLid(id);
    setCid(clubs.find((c) => c.league === id)!.id);
  };
  const defaultManager = (!unemployed && club.manager?.name) || DEFAULT_MANAGER;
  const start = () =>
    onStart({
      club: cid,
      manager: manager.trim() || defaultManager,
      mode,
      firstSeasonTransferBan: ban,
      revealPotential: reveal,
      unemployed,
      preseason,
    });

  return (
    <div className="ui-setup">
      <header className="ui-setup-header">
        <div className="brand">
          <Baseball />
          <span>
            DUGOUT<i>BASEBALL MANAGEMENT</i>
          </span>
        </div>
        <div className="ui-setup-header-right">
          {existing && (
            <button className="ui-btn ui-btn-ghost" onClick={cancel}>
              기존 커리어로 돌아가기
            </button>
          )}
          <button className="ui-icon-btn" aria-label="게임 안내" onClick={() => setHelp(true)}>
            <CircleHelp size={20} />
          </button>
        </div>
      </header>

      <main className="ui-setup-main">
        <ol className="ui-steps" aria-label="새 커리어 진행 단계">
          <li className={step === 'club' ? 'current' : 'done'}>
            <span className="ui-step-no">{step === 'club' ? '1' : <Check size={13} />}</span>
            {unemployed ? '시작 리그 선택' : '구단 선택'}
          </li>
          <li className={step === 'manager' ? 'current' : ''}>
            <span className="ui-step-no">2</span>
            감독 · 시즌 설정
          </li>
        </ol>

        {error && (
          <div className="ui-alert" role="alert">
            <span>{error}</span>
            <button className="ui-btn ui-btn-ghost" onClick={retry}>
              다시 불러오기
            </button>
          </div>
        )}

        {step === 'club' ? (
          <section className="ui-step-body" aria-labelledby="ui-step1-title">
            <div className="ui-step-title">
              <h1 id="ui-step1-title">
                {unemployed ? '무직 감독 · 친숙한 리그 선택' : '어느 구단을 맡을까요?'}
              </h1>
              <p>
                {unemployed
                  ? '잘 아는 리그를 고르세요. 구단의 연락을 기다리거나 직접 새 자리에 도전할 수 있습니다.'
                  : `${leagues.length}개 리그 · ${clubs.length}개 구단에서 감독 경력을 시작하세요.`}
              </p>
            </div>

            <div className="career-start-options" role="group" aria-label="커리어 시작 상태">
              <button aria-pressed={!unemployed} onClick={() => setUnemployed(false)}>
                <span className="start-option-icon">⚾</span>
                <span>
                  <strong>구단을 맡아서 시작</strong>
                  <small>선수단을 이어받아 곧바로 시즌에 도전합니다.</small>
                </span>
                {!unemployed && <Check size={18} />}
              </button>
              <button aria-pressed={unemployed} onClick={() => setUnemployed(true)}>
                <span className="start-option-icon">✉</span>
                <span>
                  <strong>무직으로 시작</strong>
                  <small>뉴스와 구단의 제의를 보며 첫 직장을 구합니다.</small>
                </span>
                {unemployed && <Check size={18} />}
              </button>
            </div>
            <div className="ui-region-row" role="group" aria-label="대륙">
              {regions.map((r) => (
                <button
                  key={r}
                  aria-pressed={region === r}
                  className={`ui-chip ${region === r ? 'active' : ''}`}
                  onClick={() => {
                    setRegion(r);
                    if (r !== '전체' && league.region !== r) {
                      const first = leagues.find((v) => v.region === r);
                      if (first) pickLeague(first.id);
                    }
                  }}
                >
                  {r === '전체' ? '모든 대륙' : r}
                </button>
              ))}
            </div>

            <div className="ui-league-row" aria-label="리그">
              {visibleLeagues.map((v) => (
                <button
                  key={v.id}
                  className={`ui-league ${v.id === lid ? 'active' : ''}`}
                  aria-pressed={v.id === lid}
                  onClick={() => pickLeague(v.id)}
                >
                  <span className="ui-league-flag">{v.flag}</span>
                  <span className="ui-league-name">{v.name}</span>
                  <span className="ui-league-meta">
                    {v.country} · {clubs.filter((c) => c.league === v.id).length}
                  </span>
                </button>
              ))}
            </div>

            <div hidden={unemployed} className="ui-club-head">
              <h2>
                {league.flag} {league.name}
                <small>
                  {league.country} · {league.season} · {leagueClubs.length}개 구단
                </small>
              </h2>
            </div>
            <div
              hidden={unemployed}
              className="ui-club-grid"
              role="group"
              aria-label={`${league.name} 구단`}
            >
              {leagueClubs.map((v) => (
                <button
                  key={v.id}
                  aria-pressed={v.id === cid}
                  className={`ui-club ${v.id === cid ? 'active' : ''}`}
                  style={{ '--club': v.color } as CSSProperties}
                  onClick={() => setCid(v.id)}
                  onDoubleClick={() => setStep('manager')}
                >
                  <Badge club={v} size="small" />
                  <span className="ui-club-text">
                    <strong>{v.name}</strong>
                    <small>{v.city}</small>
                  </span>
                  {v.id === cid && <Check size={16} className="ui-club-check" />}
                </button>
              ))}
            </div>

            <div className="ui-action-bar">
              <div className="ui-selected">
                <>
                  {unemployed ? (
                    <span className="start-option-icon">{league.flag}</span>
                  ) : (
                    <Badge club={club} size="small" />
                  )}
                </>
                <span>
                  <small>
                    {unemployed ? '친숙한 리그' : '선택한 구단'} · {league.name}
                  </small>
                  <strong>{unemployed ? '무직 감독' : club.name}</strong>
                </span>
              </div>
              <button
                className="ui-btn ui-btn-primary"
                disabled={loading || !!error}
                onClick={() => setStep('manager')}
              >
                {unemployed ? '감독 설정으로 계속' : `${club.name} 선택하고 계속`}
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        ) : (
          <section className="ui-step-body" aria-labelledby="ui-step2-title">
            <div className="ui-step-title">
              <button className="ui-back" onClick={() => setStep('club')}>
                <ArrowLeft size={15} />
                구단 다시 선택
              </button>
              <h1 id="ui-step2-title">감독과 시즌을 설정하세요</h1>
              <p>시즌 길이와 잠재력 공개 여부는 시작 후 바꿀 수 없습니다.</p>
            </div>

            <div className="ui-setup-grid">
              {unemployed ? (
                <aside className="ui-club-card">
                  <h2>무직 감독</h2>
                  <p>친숙한 리그 · {league.name}</p>
                  <p>평판 60 · 급여 없음</p>
                  <p>{preseason ? '개막 4주 전부터 구직 시작' : '정규시즌 개막일부터 구직 시작'}</p>
                  <p>지원 → 면접 → 계약 → 해당 구단 시즌 이어받기</p>
                </aside>
              ) : (
                <aside className="ui-club-card" style={{ '--club': club.color } as CSSProperties}>
                  <div className="ui-club-card-head">
                    <Badge club={club} size="large" />
                    <div>
                      <small>
                        {league.flag} {league.name} · {league.country}
                      </small>
                      <h2>{club.name}</h2>
                      <span>{club.city}</span>
                    </div>
                  </div>
                  <dl className="ui-facts">
                    <div>
                      <dt>운영 예산</dt>
                      <dd>{money(teamBudget(lid))}</dd>
                    </div>
                    <div>
                      <dt>선수단</dt>
                      <dd>{roster.length}명</dd>
                    </div>
                    <div>
                      <dt>실명 선수</dt>
                      <dd>{roster.filter((p) => p.real).length}명</dd>
                    </div>
                  </dl>
                  <button
                    className="ui-disclosure"
                    aria-expanded={showPlayers}
                    onClick={() => setShowPlayers((v) => !v)}
                  >
                    주요 선수 {featured.length}명
                    <ChevronDown size={15} className={showPlayers ? 'open' : ''} />
                  </button>
                  {showPlayers && (
                    <ul className="ui-player-list">
                      {featured.map((p) => (
                        <li key={p.id}>
                          <span className="ui-pos">{p.pos}</span>
                          <span className="ui-player-text">
                            <strong>{p.name}</strong>
                            <small>
                              {p.real ? '실명' : '가상'} · {p.ageEstimated ? '게임 나이 ' : ''}
                              {p.age}세
                            </small>
                          </span>
                          <Rating value={overall(p)} player={p} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="ui-note">
                    실명·가상 선수 포함.{' '}
                    <button className="ui-link" onClick={() => setHelp(true)}>
                      데이터 안내
                    </button>
                  </p>
                </aside>
              )}

              <form
                className="ui-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!disabled) start();
                }}
              >
                <label className="ui-field">
                  <span className="ui-field-label">감독 이름</span>
                  <input
                    className="ui-input"
                    maxLength={24}
                    placeholder={defaultManager}
                    autoComplete="off"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                  />
                  <small>비워 두면 &lsquo;{defaultManager}&rsquo;으로 표시됩니다.</small>
                </label>

                <fieldset className="ui-field">
                  <legend className="ui-field-label">시즌 길이</legend>
                  <div className="ui-option-row">
                    {[
                      ['short', '단축 시즌', '상대별 2경기 · 2연전'],
                      ['full', '정규 길이', `${league.name} 기준 약 ${league.games}경기`],
                    ].map(([value, title, desc]) => (
                      <label key={value} className={`ui-option ${mode === value ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="mode"
                          value={value}
                          checked={mode === value}
                          onChange={() => setMode(value)}
                        />
                        <strong>{title}</strong>
                        <small>{desc}</small>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="ui-field">
                  <legend className="ui-field-label">시즌 시작 시점</legend>
                  <div className="ui-option-row season-start-options">
                    {seasonStartOptions.map((option) => (
                      <label
                        key={String(option.value)}
                        className={`ui-option ${preseason === option.value ? 'active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="preseason"
                          value={String(option.value)}
                          checked={preseason === option.value}
                          onChange={() => setPreseason(option.value)}
                        />
                        <span className="ui-option-icon" aria-hidden="true">
                          {option.icon}
                        </span>
                        <strong>{option.title}</strong>
                        <small>{option.desc}</small>
                        <span className="ui-option-tag">{option.tag}</span>
                      </label>
                    ))}
                  </div>
                  <small className="ui-note">
                    {unemployed
                      ? preseason
                        ? '개막 4주 전 날짜에서 구직을 시작합니다. 개막 전에 계약하면 해당 구단의 프리시즌을 맡습니다.'
                        : '리그 개막일 날짜에서 구직을 시작합니다. 계약한 구단의 정규시즌을 바로 이어받습니다.'
                      : preseason
                        ? '진행 중에도 홈이나 경기 준비에서 남은 프리시즌을 코치에게 맡기고 개막으로 넘어갈 수 있습니다.'
                        : `${league.name} 개막일에 취임합니다. 감독 계약일과 시즌 기록은 개막일부터 시작됩니다.`}
                  </small>
                </fieldset>

                <fieldset className="ui-field">
                  <legend className="ui-field-label">시작 규칙</legend>
                  <label className={`ui-check ${ban ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={ban}
                      onChange={(e) => setBan(e.target.checked)}
                    />
                    <span>
                      <strong>첫 시즌 외부 선수 영입 금지</strong>
                      <small>FA 포함 · 재계약, 매각, 코치 선임은 가능</small>
                    </span>
                  </label>
                  <label className={`ui-check ${reveal ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={reveal}
                      onChange={(e) => setReveal(e.target.checked)}
                    />
                    <span>
                      <strong>잠재력 공개</strong>
                      <small>기본은 숨김 · 시작 후 변경 불가</small>
                    </span>
                  </label>
                </fieldset>

                <div className="ui-form-actions">
                  <button
                    className="ui-btn ui-btn-primary ui-btn-lg"
                    type="submit"
                    disabled={disabled}
                  >
                    {busy || loading ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : (
                      <>
                        {unemployed ? '무직으로 커리어 시작' : `${club.name} 감독으로 취임`}
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                  <small>경기와 계약은 자동 저장됩니다.</small>
                </div>
              </form>
            </div>
          </section>
        )}

        <footer className="ui-setup-foot">
          <span>
            2026 시즌 · {leagues.length}개 리그 · {clubs.length}개 구단
          </span>
          <button className="ui-link" onClick={() => setHelp(true)}>
            게임 규칙과 도움말
          </button>
        </footer>
      </main>
      <Help open={help} close={() => setHelp(false)} />
    </div>
  );
}
