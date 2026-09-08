'use client';
import { type CSSProperties } from 'react';
import { RotateCcw, UserRound, CircleDot as Baseball } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';
import { useWorld } from './world-context';
import { type GameState } from '@dugout/shared/game-view';
import { Badge } from '../../components/game-ui';
import { nav } from './game-navigation';

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
  const groups = [
    { label: '구단', ids: ['home', 'inbox', 'squad', 'dynamics', 'reserves', 'tactics'] },
    { label: '대회', ids: ['schedule', 'world'] },
    { label: '운영', ids: ['market', 'agents', 'staff', 'finance'] },
  ];
  return (
    <Sidebar className="app-sidebar">
      <SidebarHeader>
        <div className="brand">
          <Baseball />
          <span>
            DUGOUT<i>BASEBALL MANAGEMENT</i>
          </span>
          <b className="edition-number">26</b>
        </div>
        <div className="sidebar-club" style={{ '--club': club.color } as CSSProperties}>
          <Badge club={club} />
          <span>
            <strong>{club.name}</strong>
            <small>
              {getLeague(club.league).name} · {g.year}
            </small>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.ids.map((id) => {
                const n = nav.find((n) => n.id === id)!;
                return (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      className="nav-button"
                      isActive={view === id}
                      onClick={() => {
                        onView(id);
                        setOpenMobile(false);
                      }}
                    >
                      <n.icon />
                      <span>{n.label}</span>
                      {id === 'agents' && g.deals.length > 0 && (
                        <b className="nav-count">{g.deals.length}</b>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <button className="new-career" onClick={onNew}>
          <RotateCcw size={14} />새 커리어
        </button>
        <div className="manager">
          <span className="manager-avatar">
            <UserRound size={18} />
          </span>
          <span>
            <strong>{g.manager}</strong>
            <small>감독 · 평판 {g.reputation}</small>
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
