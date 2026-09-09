'use client';
import Link from 'next/link';
import { ReservePanel } from '../squad/reserve-panel';
import { useRouter } from 'next/navigation';
import { PlayerProfile } from '../players/player-profile';
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  ChevronsRight,
  CircleHelp,
  LoaderCircle,
  CircleDot as Baseball,
} from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { WorldProvider, useWorld } from './world-context';
import type { WorldCatalog } from '@dugout/shared/types';
import { type GameState, type Player, type Result } from '@dugout/shared/game-view';
import { DynamicsPanel } from '../clubs/club-panels';
import { InboxPanel } from '../inbox/inbox-panel';
import { PlayerContractDialog } from '../contracts/player-contract-room';
import { SchedulePanel } from '../schedule/schedule-panel';
import { dateLabel } from '@dugout/shared/calendar';
import { StadiumReplay } from '../matches/stadium-replay';
import { LiveMatchScreen } from '../matches/live-match-screen';
import { TacticalBoard } from '../squad/management-panels';
import { CoachPanel } from '../squad/coach-panel';
import { Badge } from '../../components/game-ui';
import { nav } from './game-navigation';
import type { Act, CareerData } from './game-contracts';
import { NewCareer } from './career-setup';
import { Dashboard } from './dashboard';
import { Squad } from '../squad/squad-panel';
import { World } from '../clubs/world-panel';
import { Market } from '../market/market-panel';
import { ScoutingPanel } from '../scouting/scouting-panel';
import { Agents } from '../market/agents-panel';
import { Finance } from '../finance/finance-panel';
import { Help } from './help-dialog';
import { AppSidebar } from './game-sidebar';
import { CalendarProgress, useCalendarProgress } from './calendar-progress';

export function GameScreen({
  initial,
  refreshCatalog,
  initialPlayerId,
  initialView,
}: {
  initial: CareerData;
  refreshCatalog: () => Promise<void>;
  initialPlayerId?: string;
  initialView?: string;
}) {
  const { clubs, leagues, getClub, getLeague, nextFixture, catalogVersion, marketPlayers } =
    useWorld();
  const router = useRouter();
  const view = initialPlayerId
    ? 'player'
    : nav.some((n) => n.id === initialView)
      ? initialView!
      : 'home';
  const setView = (id: string) => router.push('/?view=' + encodeURIComponent(id));
  const setPlayer = (p: Player) =>
    router.push('/players/' + encodeURIComponent(p.id) + '?from=' + encodeURIComponent(view));
  const [g, setG] = useState<GameState | null>(initial.state),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(false),
    [newConfirm, setNewConfirm] = useState(false),
    [replay, setReplay] = useState<Result | null>(null),
    [help, setHelp] = useState(false),
    [saveFailed, setSaveFailed] = useState(false);
  const [contractPlayer, setContractPlayer] = useState<Player | null>(null);
  const locked = useRef(false);
  const revision = useRef(initial.revision);
  const [ledger, setLedger] = useState(initial.ledger);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/career', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '커리어를 불러오지 못했습니다.');
      setG(d.state);
      revision.current = d.revision;
      setLedger(d.ledger || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }
  const act: Act = async (action) => {
    if (locked.current) return null;
    locked.current = true;
    setBusy(true);
    try {
      const res = await fetch('/api/career', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...action,
          revision: revision.current,
          requestId: crypto.randomUUID(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (res.status === 409 && 'state' in d) {
          setG(d.state);
          revision.current = d.revision;
          setLedger(d.ledger || []);
        }
        throw new Error(d.error || d.message || '요청을 처리하지 못했습니다.');
      }
      setG(d.state);
      revision.current = d.revision;
      setLedger(d.ledger || []);
      setSaveFailed(false);
      return d.state;
    } catch (e) {
      setSaveFailed(true);
      toast.error(e instanceof Error ? e.message : '저장하지 못했습니다.');
      return null;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const calendarProgress = useCalendarProgress(act);
  const progressing = calendarProgress.journey?.running === true;
  async function openReplay(result: Result) {
    if (result.log.length) {
      setReplay(result);
      return;
    }
    try {
      const res = await fetch('/api/career/matches/' + encodeURIComponent(result.id), {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReplay(data);
    } catch {
      toast.error('경기 기록을 불러오지 못했습니다. 다시 시도해 주세요.');
    }
  }
  async function simulate(count = 1, watch = false) {
    if (!g || g.liveMatch || busy || progressing) return;
    if (count === 1 && watch && nextFixture(g) && !g.news.some((n) => n.choiceKind && !n.choice)) {
      await act({ type: 'startMatch' });
      return;
    }
    const next = await calendarProgress.run(g, count === 1 ? 45 : count, count > 1);
    if (next?.progress?.newsIds.length) setView('inbox');
  }
  if (!g || setup)
    return (
      <>
        <NewCareer
          loading={loading}
          error={error}
          retry={load}
          busy={busy}
          existing={!!g}
          cancel={() => setSetup(false)}
          onStart={async (club, manager, mode, firstSeasonTransferBan, revealPotential) => {
            const result = await act({
              type: 'start',
              club,
              manager,
              mode,
              firstSeasonTransferBan,
              revealPotential,
              replace: !!g,
            });
            if (result) {
              await refreshCatalog();
              setSetup(false);
              setView('home');
              toast.success(`${getClub(club).name}의 감독으로 취임했습니다.`);
            }
          }}
        />
        <Link className="setup-save-link text-button" href="/saves">
          저장 관리 · 복구
        </Link>
        <Toaster theme="light" position="bottom-right" />
      </>
    );
  const club = getClub(g.club),
    league = getLeague(club.league);
  const pending = busy;
  const selectedPlayer = initialPlayerId
    ? g.roster.find((p) => p.id === initialPlayerId) ||
      marketPlayers(g).find((p) => p.id === initialPlayerId)
    : undefined;
  return (
    <SidebarProvider style={{ '--sidebar-width': '224px' } as CSSProperties}>
      <div style={{ display: 'contents' }} inert={progressing || undefined}>
        <AppSidebar g={g} view={view} onView={setView} onNew={() => setNewConfirm(true)} />
      </div>
      <main className="workspace">
        <header className="topbar" inert={progressing || undefined}>
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-menu" aria-label="메뉴 열기" />
            <Badge club={club} size="small" />
            <div>
              <strong>{club.name}</strong>
              <span>
                {league.name}
                <ChevronRight size={11} />
                {view === 'player' ? '선수 상세' : nav.find((n) => n.id === view)?.label}
              </span>
            </div>
          </div>
          <div className="topbar-right">
            <span className={`save-state ${saveFailed ? 'save-error' : ''}`} aria-live="polite">
              {pending ? <LoaderCircle className="spin" size={12} /> : <Check size={12} />}{' '}
              {pending ? '저장 중' : saveFailed ? '저장 확인 필요' : '자동 저장됨'}
            </span>
            <button className="icon-button" aria-label="게임 안내" onClick={() => setHelp(true)}>
              <CircleHelp size={18} />
            </button>
            <div className="date">
              <b>{g.year} 시즌</b>
              <span>
                {g.phase === 'preseason'
                  ? dateLabel(g)
                  : g.phase === 'regular'
                    ? `${dateLabel(g)} · 정규 시즌`
                    : g.phase === 'semifinal'
                      ? '플레이오프 · 준결승'
                      : g.phase === 'final'
                        ? '플레이오프 · 결승'
                        : '시즌 종료'}
              </span>
            </div>
            <div className="page-actions">
              {g.phase !== 'finished' ? (
                <>
                  <details className="advance-menu">
                    <summary aria-label="자동 진행 옵션">
                      <ChevronsRight size={18} />
                    </summary>
                    <div>
                      <strong>자동 진행</strong>
                      <p>
                        경기를 자동 계산하며 최대 7일 진행합니다. 새 리포트가 도착하면 멈춥니다.
                      </p>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={(event) => {
                          event.currentTarget.closest('details')?.removeAttribute('open');
                          void simulate(7);
                        }}
                      >
                        7일 자동 진행
                      </button>
                    </div>
                  </details>
                  <button
                    className="button primary continue-button"
                    disabled={busy}
                    onClick={() => simulate(1, true)}
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <>
                        <span>{nextFixture(g) ? '경기 진행' : '계속 진행'}</span>
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  className="button primary continue-button"
                  disabled={busy}
                  onClick={() => act({ type: 'nextSeason' })}
                >
                  다음 시즌
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        </header>
        {calendarProgress.journey && (
          <CalendarProgress
            journey={calendarProgress.journey}
            g={g}
            pause={calendarProgress.pause}
            close={calendarProgress.close}
            onReports={() => setView('inbox')}
          />
        )}
        <div className="workspace-body" inert={progressing || undefined}>
          {saveFailed && (
            <div className="decision-banner" role="alert">
              <span>마지막 요청을 완료하지 못했습니다. 저장된 상태를 다시 확인해 주세요.</span>
              <button className="text-button" onClick={() => window.location.reload()}>
                저장 상태 다시 불러오기
              </button>
            </div>
          )}
          {g.news.some((n) => n.choiceKind && !n.choice) && (
            <div className="decision-banner">
              <span>감독의 답변을 기다리는 선수 면담이 있습니다.</span>
              <button className="text-button" onClick={() => setView('inbox')}>
                수신함에서 확인 →
              </button>
            </div>
          )}
          {g.catalogVersion !== catalogVersion && (
            <div className="preseason-banner">
              <strong>선수·코치 DB 업데이트</strong>
              <span>현재 계약과 시즌 기록을 유지하며 누락 선수를 추가합니다.</span>
              <button disabled={busy} onClick={() => act({ type: 'syncCatalog' })}>
                새 명단 반영 →
              </button>
            </div>
          )}
          {g.phase === 'preseason' && view === 'tactics' && (
            <div className="preseason-banner">
              <strong>정규시즌 개막까지 {-g.day}일</strong>
              <span>
                전술 숙련도 {Math.round(g.tacticFamiliarity ?? 55)}% · 연습경기{' '}
                {g.history.filter((r) => r.friendly).length}/4회
              </span>
              <button onClick={() => setView('tactics')}>전술 준비 →</button>
            </div>
          )}
          {view !== 'home' && (
            <div className="page-title">
              <h1>{view === 'player' ? '선수 상세' : nav.find((n) => n.id === view)?.label}</h1>
              <p>
                {view === 'squad'
                  ? `${g.roster.length}명 등록`
                  : view === 'reserves'
                    ? '명단을 확인하고 등록 선수를 교체하세요'
                    : view === 'agents'
                      ? `${g.deals.length}건의 협상`
                      : view === 'staff'
                        ? `${g.staff.length}명의 코칭 스태프`
                        : league.name}
              </p>
            </div>
          )}
          {view === 'player' && (
            <>
              <Link
                className="text-button player-back"
                href={
                  '/?view=' +
                  encodeURIComponent(nav.some((n) => n.id === initialView) ? initialView! : 'squad')
                }
              >
                ← 목록으로
              </Link>
              {selectedPlayer ? (
                <PlayerProfile
                  key={selectedPlayer.id}
                  player={selectedPlayer}
                  game={g}
                  act={act}
                  busy={busy}
                />
              ) : (
                <section className="panel panel-content">
                  <h2>선수를 찾을 수 없습니다</h2>
                  <p>이 커리어에 없거나 더 이상 조회할 수 없는 선수입니다.</p>
                  <Link href="/?view=squad">선수단으로</Link>
                </section>
              )}
            </>
          )}
          {view === 'home' && (
            <Dashboard
              g={g}
              setView={setView}
              simulate={() => simulate(1, true)}
              act={act}
              busy={busy}
              onPlayer={setPlayer}
              replay={openReplay}
            />
          )}
          {view === 'inbox' && (
            <InboxPanel
              key={g.news[0]?.id}
              onNegotiate={setContractPlayer}
              g={g}
              act={act}
              busy={busy || contractPlayer !== null}
              onPlayer={setPlayer}
            />
          )}
          {view === 'dynamics' && <DynamicsPanel g={g} onPlayer={setPlayer} />}
          {view === 'squad' && <Squad g={g} onPlayer={setPlayer} act={act} busy={busy} />}
          {view === 'reserves' && <ReservePanel g={g} act={act} busy={busy} onPlayer={setPlayer} />}
          {view === 'tactics' && <TacticalBoard g={g} act={act} busy={busy} onPlayer={setPlayer} />}
          {view === 'schedule' && <SchedulePanel g={g} replay={openReplay} />}
          {view === 'world' && <World g={g} onPlayer={setPlayer} />}
          {view === 'market' && <Market g={g} onPlayer={setPlayer} />}
          {view === 'scouting' && (
            <ScoutingPanel
              g={g}
              act={act}
              busy={busy}
              onPlayer={setPlayer}
              onNegotiate={setContractPlayer}
            />
          )}
          {view === 'agents' && (
            <Agents g={g} busy={busy} onPlayer={setPlayer} onNegotiate={setContractPlayer} />
          )}
          {view === 'staff' && <CoachPanel g={g} act={act} busy={busy} />}
          {view === 'finance' && <Finance g={g} ledger={ledger} />}
        </div>
        <footer className="game-footer" inert={progressing || undefined}>
          <span>
            DUGOUT <b>2026</b> · {leagues.length} 리그 · {clubs.length} 구단
          </span>
          <button onClick={() => setHelp(true)}>
            게임 규칙 · 데이터 안내 <ArrowUpRight size={13} />
          </button>
        </footer>
      </main>
      <>{g.liveMatch && <LiveMatchScreen g={g} act={act} busy={busy} />}</>
      <StadiumReplay result={replay} close={() => setReplay(null)} />
      {contractPlayer && (
        <PlayerContractDialog
          player={g.roster.find((p) => p.id === contractPlayer.id) || contractPlayer}
          g={g}
          act={act}
          busy={busy}
          close={() => setContractPlayer(null)}
        />
      )}
      <Help open={help} close={() => setHelp(false)} />
      <AlertDialog open={newConfirm} onOpenChange={setNewConfirm}>
        <AlertDialogContent className="confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>새 구단에서 시작할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              새 커리어를 최종 시작하면 현재 커리어의 선수·계약·시즌 기록이 교체됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction onClick={() => setSetup(true)}>구단 선택으로</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster theme="light" position="bottom-right" />
    </SidebarProvider>
  );
}

export default function Game({
  initialPlayerId,
  initialView,
}: { initialPlayerId?: string; initialView?: string } = {}) {
  const [data, setData] = useState<{ world: WorldCatalog; career: CareerData } | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all(
      ['/api/catalog', '/api/career'].map(async (url) => {
        const response = await fetch(url, { cache: 'no-store', signal: abort.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '데이터를 불러오지 못했습니다.');
        return body;
      }),
    )
      .then(([world, career]) => setData({ world, career }))
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message || '연결하지 못했습니다.');
      });
    return () => abort.abort();
  }, [attempt]);
  if (!data)
    return (
      <main className="catalog-loading">
        <div className="brand">
          <Baseball />
          <span>
            DUGOUT<i>WORLD BASEBALL MANAGER</i>
          </span>
        </div>
        {error ? (
          <>
            <h1>커리어를 불러오지 못했습니다</h1>
            <p>{error}</p>
            <button
              className="button primary"
              onClick={() => {
                setError('');
                setAttempt((n) => n + 1);
              }}
            >
              다시 연결
            </button>
          </>
        ) : (
          <>
            <LoaderCircle size={32} className="spin" />
            <h1>커리어 불러오는 중</h1>
            <p>리그, 선수단, 저장된 커리어를 불러오는 중입니다.</p>
          </>
        )}
      </main>
    );
  return (
    <WorldProvider world={data.world}>
      <GameScreen
        initial={data.career}
        initialPlayerId={initialPlayerId}
        initialView={initialView}
        refreshCatalog={async () => {
          const response = await fetch('/api/catalog', { cache: 'no-store' });
          if (!response.ok)
            throw new Error('선수 DB를 새로 불러오지 못했습니다. 새로고침해 주세요.');
          const world = await response.json();
          setData((current) => (current ? { ...current, world } : current));
        }}
      />
    </WorldProvider>
  );
}
