import Link from 'next/link';
import type { useManagerPersonProfile } from './use-manager-person-profile';
import { managerAbilityLabels } from '@dugout/shared/manager-ability';
type Profile = ReturnType<typeof useManagerPersonProfile>;
export function ManagerConnections({ profile: p }: { profile: Profile }) {
  return (
    <section className="dossier-card manager-connections">
      <header>
        <h2>함께한 사람들</h2>
        <label>
          관계{' '}
          <select
            value={p.connectionFilter}
            onChange={(e) => p.setConnectionFilter(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="students">육성한 제자</option>
            <option value="coaches">코치 · 선수 시절 동료</option>
          </select>
        </label>
      </header>
      <p className="person-profile-note">
        실제 훈련과 경기, 직접 전한 말로 신뢰를 쌓습니다. 23세 이하 시기에 28일 이상 함께 훈련하고
        기량이 0.5 이상 성장한 선수는 제자로 기록합니다.
      </p>
      <div className="manager-connection-grid">
        {p.connections.map((r) => (
          <article key={r.id}>
            <small>
              {r.origin === 'teammate'
                ? '선수 시절 동료 · 가상 인물'
                : r.student
                  ? '육성한 제자'
                  : r.kind === 'coach'
                    ? '함께한 코치'
                    : '지도한 선수'}
            </small>
            <h3>
              <Link
                href={`/${r.kind === 'coach' ? 'coaches' : 'players'}/${encodeURIComponent(r.id)}`}
              >
                {r.name} ↗
              </Link>
            </h3>
            <p>
              {r.origin === 'teammate'
                ? `${p.background?.playingCareer?.entries[0]?.team || '선수 시절 팀'}에서 함께 뛰었던 동료입니다.`
                : `${p.getClub(r.club).short}에서 함께한 기록`}
            </p>
            <div className="manager-connection-trust">
              <span>신뢰 {Math.round(r.trust)} / 100</span>
              <progress max={100} value={r.trust} aria-label={`${r.name} 신뢰`} />
            </div>
            <p>
              {r.matches}경기 동행 · {r.trainingDays}일 훈련
            </p>
            {r.kind === 'coach' ? (
              <small>
                재합류 협상 시 기대 연봉 {Math.round(r.discount * 100)}% 완화 · 보직·계약 조건은
                별도 검토
              </small>
            ) : (
              <small>
                {r.trust > 50
                  ? '직접 전하는 긍정 메시지를 더 잘 받아들입니다.'
                  : '함께 경험을 쌓으면 대화 신뢰가 높아집니다.'}
              </small>
            )}
            {r.lastReunion && <p>최근 상대 팀에서 재회 · {r.lastReunion}</p>}
            {r.available && p.canOfferConnection && (
              <button className="button secondary" onClick={() => p.setConnectionOffer(r.id)}>
                코치직 제안
              </button>
            )}
          </article>
        ))}
      </div>
      {!p.connections.length && (
        <p>해당 관계가 아직 없습니다. 훈련과 경기를 함께하면 여기에 기록됩니다.</p>
      )}
    </section>
  );
}
export function ManagerAchievements({ profile: p }: { profile: Profile }) {
  const journey = p.journey;
  return (
    <div className="manager-history-grid">
      <section className="dossier-card manager-achievements">
        <header>
          <h2>감독의 발자취</h2>
          <span>{journey?.achievements.length || 0}개 업적</span>
        </header>
        <p className="manager-background-summary">
          {journey?.games || 0}경기 · {journey?.wins || 0}승
        </p>
        <p className="person-profile-note">
          {journey?.started || '기록 시작'} 이후 직접 쌓은 공식 경기 기록입니다. 이전 경력과
          연습경기는 승수에 합산하지 않습니다.
        </p>
        <ol className="manager-history-list">
          {[...(journey?.achievements || [])].reverse().map((a) => (
            <li key={a.id}>
              <div className="manager-history-date">{a.date}</div>
              <div>
                <h3>{a.title}</h3>
                <p>
                  {p.getClub(a.club).short} · {a.detail}
                </p>
                {a.playerId && (
                  <Link href={`/players/${encodeURIComponent(a.playerId)}`}>선수 보기 →</Link>
                )}
              </div>
            </li>
          ))}
        </ol>
        {!journey?.achievements.length && (
          <p>첫 승, 통산 승수, 시즌 우승, 육성 선수의 1군 기용과 국가대표 선발을 기록합니다.</p>
        )}
        <div className="manager-next-achievement">
          다음 승수 업적{' '}
          <b>
            {[1, 10, 50, 100, 300, 500, 1000].find((n) => n > (journey?.wins || 0)) || '모두 달성'}
            승
          </b>
        </div>
      </section>
      <section className="dossier-card">
        <header>
          <h2>최근 지도 경험</h2>
        </header>
        <ol className="manager-history-list">
          {(journey?.recentExperience || []).map((entry, index) => (
            <li key={`${entry.date}:${entry.key}:${index}`}>
              <div className="manager-history-date">{entry.date}</div>
              <div>
                <h3>
                  {managerAbilityLabels[entry.key]} +{entry.amount} XP
                </h3>
                <p>{entry.reason}</p>
              </div>
            </li>
          ))}
        </ol>
        {!journey?.recentExperience.length && (
          <p>경기 운영, 육성, 직접 대화와 관찰 보고를 마치면 기록됩니다.</p>
        )}
      </section>
    </div>
  );
}
