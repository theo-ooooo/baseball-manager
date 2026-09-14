import Link from 'next/link';
import type { useManagerPersonProfile } from './use-manager-person-profile';
type Profile = ReturnType<typeof useManagerPersonProfile>;

export function ManagerProfileHistory({
  profile: p,
  compact = false,
}: {
  profile: Profile;
  compact?: boolean;
}) {
  const background = p.background;
  return (
    <div className={compact ? 'manager-history-preview' : 'manager-history-grid'}>
      <section className="dossier-card">
        <header>
          <h2>게임에서 이어가는 경력</h2>
          <span>{p.career.length}건</span>
        </header>
        <ol className="manager-history-list">
          {(compact ? p.career.slice(0, 3) : p.career).map((entry, i) => (
            <li key={`${entry.club}:${entry.from}:${i}`}>
              <div className="manager-history-date">
                {entry.from || '날짜 미기록'}
                <span>{entry.active ? '현재' : entry.to || '퇴임일 미기록'}</span>
              </div>
              <div>
                <span className={entry.active ? 'dossier-badge' : 'manager-history-role'}>
                  {entry.role} · {entry.active ? '재임 중' : '이전 소속'}
                </span>
                <h3>
                  <Link href={`/clubs/${entry.club}`}>{p.getClub(entry.club).name}</Link>
                </h3>
                {entry.detail && <p>{entry.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
        {!p.career.length && (
          <p className="person-profile-note">
            첫 구단을 맡으면 이곳에 취임과 퇴임 기록이 남습니다.
          </p>
        )}
        {compact && (
          <button className="button secondary" onClick={() => p.setTab('history')}>
            부임 전 이력까지 보기 →
          </button>
        )}
      </section>
      {!compact && (
        <section className="dossier-card">
          <header>
            <h2>부임 전 발자취</h2>
            <span>
              {p.person?.self || !p.person?.record?.real ? '가상 배경' : '확인된 실제 이력'}
            </span>
          </header>
          {background ? (
            <>
              <p className="manager-background-summary">{background.summary}</p>
              <ol className="manager-history-list">
                {[...background.entries].reverse().map((entry, i) => (
                  <li key={`${entry.from}:${entry.team}:${i}`}>
                    <div className="manager-history-date">
                      {entry.from}
                      <span>{entry.to || '취임'}</span>
                    </div>
                    <div>
                      <span className="manager-history-role">{entry.role}</span>
                      <h3>{entry.team}</h3>
                      {entry.detail && <p>{entry.detail}</p>}
                      {entry.source && (
                        <a
                          className="manager-history-source"
                          href={entry.source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          이력 출처 ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="person-profile-note">
                {background.kind === 'fictional'
                  ? '이 커리어를 위해 만든 가상 설정입니다. 위 경력의 성적은 게임 기록에 합산하지 않습니다.'
                  : `공개 자료에서 확인한 주요 이력입니다${background.asOf ? ` (${background.asOf} 확인)` : ''}. 게임의 취임·퇴임과 성적은 별도로 기록됩니다.`}
              </p>
            </>
          ) : (
            <p className="person-profile-note">
              아직 확인된 부임 전 이력이 없습니다. 현재 커리어의 소속과 재임 기록은 왼쪽에서 확인할
              수 있습니다.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
