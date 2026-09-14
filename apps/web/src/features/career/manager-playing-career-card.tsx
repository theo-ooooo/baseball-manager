import type { ManagerPlayingCareer } from '@dugout/shared/manager-background';

export function ManagerPlayingCareerCard({
  career,
  fictional,
}: {
  career: ManagerPlayingCareer;
  fictional: boolean;
}) {
  return (
    <section className="dossier-card manager-playing-career" aria-label="선수 시절">
      <header>
        <h2>선수 시절</h2>
        <span>{fictional ? '가상 선수 이력' : '실제 선수 이력'}</span>
      </header>
      <div className="manager-playing-layout">
        <div>
          <dl className="manager-playing-facts">
            <div>
              <dt>현역 포지션</dt>
              <dd>{career.position}</dd>
            </div>
            <div>
              <dt>선수 생활</dt>
              <dd>
                {career.from} — {career.to}
              </dd>
            </div>
          </dl>
          <p className="manager-playing-summary">{career.summary}</p>
          {career.record && <p className="manager-playing-record">{career.record}</p>}
          <div className="manager-playing-retirement">
            <h3>유니폼을 벗은 뒤</h3>
            <p>{career.retirement}</p>
          </div>
          {fictional && (
            <p className="person-profile-note">이 커리어를 위해 만든 선수 시절 설정입니다.</p>
          )}
        </div>
        <div>
          <h3 className="manager-playing-teams-title">선수 시절 소속</h3>
          <ol className="manager-history-list">
            {career.entries.map((entry, i) => (
              <li key={`${entry.from}:${entry.team}:${i}`}>
                <div className="manager-history-date">
                  {entry.from}
                  {entry.to && entry.to !== entry.from && <span>{entry.to}</span>}
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
                      소속 이력 출처 ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {!!career.sources?.length && (
        <nav className="manager-playing-sources" aria-label="선수 시절 자료 출처">
          {career.sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
              {source.label} ↗
            </a>
          ))}
        </nav>
      )}
    </section>
  );
}
