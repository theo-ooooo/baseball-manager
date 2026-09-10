'use client';
import { useMemo, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { scoutingCost, type ScoutReport } from '@dugout/shared/scouting';
import { useWorld } from '../career/world-context';
const emptyReports: ScoutReport[] = [];
export function useScoutCenter(
  g: GameState,
  act: Act,
  initialTab?: string,
  initialMissionId?: string,
) {
  const { getClub, marketPlayers } = useWorld();
  const [tab, setTab] = useState(
      initialTab && ['reports', 'missions', 'shortlist'].includes(initialTab)
        ? initialTab
        : g.scouting?.reports.length
          ? 'reports'
          : 'missions',
    ),
    [league, setLeague] = useState(getClub(g.club).league),
    [pos, setPos] = useState('all'),
    [maxAge, setMaxAge] = useState(25),
    [days, setDays] = useState(14),
    [selected, setSelected] = useState<string[]>([]);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [reportQuery, setReportQuery] = useState('');
  const [reportSort, setReportSort] = useState('recent');
  const [missionId, setMissionId] = useState(initialMissionId || '');
  const market = useMemo(() => new Map(marketPlayers(g).map((p) => [p.id, p])), [g, marketPlayers]);
  const s = g.scouting,
    active = s?.assignments.filter((t) => t.status === 'active') || [],
    scout = g.staff.find((c) => c.role === '스카우트');
  const reports = s?.reports || emptyReports,
    cost = scoutingCost(days, true);
  const pastMissions = s?.assignments.filter((task) => task.status !== 'active') || [];
  const focusedMission = pastMissions.find(
    (task) => task.id === missionId && task.status === 'completed',
  );
  const visibleReports = useMemo(() => {
    const query = reportQuery.trim().toLocaleLowerCase();
    return reports
      .filter(
        (report) =>
          (!focusedMission || focusedMission.reportIds?.includes(report.playerId)) &&
          `${report.playerName} ${report.scoutName} ${report.verdict}`
            .toLocaleLowerCase()
            .includes(query),
      )
      .sort(
        (a, b) =>
          (reportSort === 'confidence' ? b.confidence - a.confidence : 0) ||
          b.date.localeCompare(a.date) ||
          a.playerName.localeCompare(b.playerName),
      );
  }, [reports, reportQuery, reportSort, focusedMission]);
  function openMissionReports(id: string) {
    setMissionId(id);
    setReportQuery('');
    setTab('reports');
  }
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 3 ? [...ids, id] : ids,
    );
  async function dispatch() {
    const next = await act({ type: 'assignScout', league, pos, maxAge, days, scoutId: scout?.id });
    if (next) {
      setAssignmentOpen(false);
      setTab('missions');
    }
  }
  return {
    dispatch,
    assignmentOpen,
    setAssignmentOpen,
    tab,
    setTab,
    league,
    setLeague,
    pos,
    setPos,
    maxAge,
    setMaxAge,
    days,
    setDays,
    selected,
    market,
    active,
    scout,
    reports,
    visibleReports,
    pastMissions,
    focusedMission,
    reportQuery,
    setReportQuery,
    reportSort,
    setReportSort,
    openMissionReports,
    clearMission: () => setMissionId(''),
    cost,
    toggle,
  };
}
