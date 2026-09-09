'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { ScoutReport } from '@dugout/shared/scouting';
import { abilityKeys, abilityLabels } from '@dugout/shared/development';
import { money } from '@dugout/shared/game-view';

export function ScoutReportCard({ report: r }: { report: ScoutReport }) {
  return (
    <article className="scout-report-card">
      <header>
        <div>
          <small>
            {r.date} · {r.scoutName}
          </small>
          <h3>{r.playerName}</h3>
        </div>
        <span className="pill">신뢰도 {r.confidence}%</span>
      </header>
      <strong>
        {r.verdict} · 관찰 OVR {r.overall.join('–')}
      </strong>
      <dl className="scout-abilities">
        {abilityKeys
          .filter((k) => r.abilities[k])
          .map((k) => (
            <div key={k}>
              <dt>{abilityLabels[k]}</dt>
              <dd>{r.abilities[k]!.join('–')}</dd>
            </div>
          ))}
      </dl>
      <div className="scout-findings">
        <section>
          <h4>강점</h4>
          {r.strengths.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </section>
        <section>
          <h4>확인할 점</h4>
          {r.concerns.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </section>
      </div>
      <small>
        관찰 당시 연봉 {money(r.salary)} · 참고 이적료 {money(r.fee)}. 계약 조건은 협상에서
        확정됩니다.
      </small>
    </article>
  );
}

export function ScoutComparison({ reports, g }: { reports: ScoutReport[]; g: GameState }) {
  const [ownId, setOwnId] = useState('');
  const own = g.roster.find((p) => p.id === ownId);
  if (!reports.length)
    return (
      <p className="scout-empty">
        보고에서 비교할 선수를 최대 3명 선택하세요. 우리 구단 선수와 능력을 나란히 볼 수 있습니다.
      </p>
    );
  return (
    <section className="panel scout-comparison">
      <div className="panel-header">
        <h2>영입 후보 비교</h2>
        <label>
          우리 구단 기준 선수
          <select value={ownId} onChange={(e) => setOwnId(e.target.value)}>
            <option value="">선택 안 함</option>
            {g.roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.pos}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>
              <th>평가 항목</th>
              {reports.map((r) => (
                <th key={r.playerId}>{r.playerName}</th>
              ))}
              {own && <th>{own.name} · 소속</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>관찰 기준일</th>
              {reports.map((r) => (
                <td key={r.playerId}>{r.date}</td>
              ))}
              {own && <td>현재</td>}
            </tr>
            {abilityKeys.map((k) => (
              <tr key={k}>
                <th>{abilityLabels[k]}</th>
                {reports.map((r) => (
                  <td key={r.playerId}>{r.abilities[k]?.join('–') || '평가 대상 아님'}</td>
                ))}
                {own && <td>{own[k].toFixed(1)}</td>}
              </tr>
            ))}
            <tr>
              <th>연봉</th>
              {reports.map((r) => (
                <td key={r.playerId}>{money(r.salary)}</td>
              ))}
              {own && <td>{money(own.salary)}</td>}
            </tr>
            <tr>
              <th>추천</th>
              {reports.map((r) => (
                <td key={r.playerId}>{r.verdict}</td>
              ))}
              {own && <td>{own.squad === 'reserve' ? '2군' : '1군'}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
