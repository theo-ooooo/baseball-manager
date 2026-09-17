'use client';
import Link from 'next/link';
import { type CSSProperties } from 'react';
import { X, RotateCcw, UserRound, CircleDot as Baseball } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  useSidebar,
} from '@/components/ui/sidebar';
import { useWorld } from './world-context';
import { type GameState } from '@dugout/shared/game-view';
import { Badge } from '../../components/game-ui';
import { nav } from './game-navigation';
import { AppVersion } from '@/components/app-version';

export function AppSidebar({
  g,
  view,
  onView,
  onNew,
}: {
  g: GameState;
  view: string;
  onView: (v: string) => void;
  onNew: () => void;
}) {
  const { getClub, getLeague } = useWorld();
  const { setOpenMobile } = useSidebar();
  const club = getClub(g.club);
  const unemployed = g.managerCareer?.status === 'unemployed';
  const groups = unemployed
    ? [
        { label: '감독 사무실', ids: ['home', 'inbox'] },
        { label: '새 직장 찾기', ids: ['jobs', 'job-security'] },
        { label: '야구 세계', ids: ['world', 'records'] },
      ]
    : [
        { label: '더그아웃', ids: ['home', 'inbox', 'squad', 'matchday', 'schedule'] },
        { label: '구단과 리그', ids: ['scouting', 'agents', 'world', 'staff', 'vision'] },
      ];
  const children: Record<string, string[]> = {
    home: ['manager', 'manager-contract', 'manager-history', 'job-offers', 'media'],
    squad: ['reserves', 'registrations', 'training', 'tactics', 'medical', 'dynamics'],
    scouting: ['market', 'trade', 'draft', 'agents'],
    world: ['records', 'club'],
    staff: ['jobs', 'job-security'],
    vision: ['finance'],
  };
  return (
    <Sidebar className="app-sidebar">
      <SidebarHeader>
        <button
          className="sidebar-close"
          aria-label="메뉴 닫기"
          onClick={() => setOpenMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="brand">
          <Baseball />
          <span>
            DUGOUT<i>BASEBALL MANAGEMENT</i>
          </span>
        </div>
        <div
          className="sidebar-club"
          style={{ '--club': unemployed ? '#627189' : club.color } as CSSProperties}
        >
          <>
            {unemployed ? (
              <span className="unemployed-avatar">
                <UserRound aria-label="소속 구단 없음" />
              </span>
            ) : (
              <Badge club={club} />
            )}
          </>
          <span>
            <strong>{unemployed ? g.manager : club.name}</strong>
            <small>
              {unemployed
                ? '무직 · 새 구단을 찾는 중'
                : `${getLeague(club.league).name} · ${g.year}`}
            </small>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <section className="sidebar-section" key={group.label}>
            <h2>{group.label}</h2>
            <SidebarGroup>
              <SidebarMenu>
                {group.ids
                  .filter(
                    (id) =>
                      g.managerCareer?.status !== 'unemployed' ||
                      ['home', 'inbox', 'jobs', 'job-security', 'world', 'records'].includes(id),
                  )
                  .map((id) => {
                    const n = nav.find((n) => n.id === id)!;
                    return (
                      <SidebarMenuItem key={id}>
                        <SidebarMenuButton
                          className="nav-button"
                          isActive={view === id || !!children[id]?.includes(view)}
                          onClick={() => {
                            onView(id);
                            setOpenMobile(false);
                          }}
                        >
                          <n.icon />
                          <span>{id === 'vision' ? '구단 운영' : n.label}</span>
                          {id === 'inbox' && g.news.some((item) => !item.read) && (
                            <b className="nav-count">
                              {g.news.filter((item) => !item.read).length}
                            </b>
                          )}
                          {id === 'agents' && g.deals.length > 0 && (
                            <b className="nav-count">{g.deals.length}</b>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroup>
          </section>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <Link className="new-career" href="/saves">
          저장 관리 · 복구
        </Link>
        <button className="new-career" onClick={onNew}>
          <RotateCcw size={14} />새 커리어
        </button>
        <button
          className="manager manager-profile-link"
          onClick={() => {
            onView('manager');
            setOpenMobile(false);
          }}
          aria-label="내 감독 프로필 열기"
        >
          <span className="manager-avatar">
            <UserRound size={18} />
          </span>
          <span>
            <strong>{g.manager}</strong>
            <small>내 프로필 · 평판 {g.managerCareer?.reputation ?? g.reputation}</small>
          </span>
        </button>
        <AppVersion />
      </SidebarFooter>
    </Sidebar>
  );
}
