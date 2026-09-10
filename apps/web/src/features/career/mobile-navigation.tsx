'use client';
import { Menu, ChevronRight } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { nav } from './game-navigation';

export function MobileNavigation({
  view,
  unemployed,
  unread,
  disabled,
  onView,
  onContinue,
  continueLabel,
  date,
}: {
  view: string;
  unemployed: boolean;
  unread: number;
  disabled: boolean;
  onView: (view: string) => void;
  onContinue: () => void;
  continueLabel: string;
  date: string;
}) {
  const { setOpenMobile } = useSidebar();
  const ids = unemployed
    ? ['home', 'inbox', 'jobs', 'world']
    : ['home', 'inbox', 'squad', 'scouting'];
  return (
    <nav className="mobile-game-nav" aria-label="모바일 바로가기">
      <div className="mobile-progress">
        <span>{date}</span>
        <button disabled={disabled} onClick={onContinue}>
          {disabled ? '처리 중…' : continueLabel}
          <ChevronRight size={18} />
        </button>
      </div>
      {ids.map((id) => {
        const item = nav.find((entry) => entry.id === id)!;
        const active =
          view === id ||
          (id === 'squad' &&
            ['reserves', 'registrations', 'training', 'tactics', 'medical', 'dynamics'].includes(
              view,
            ));
        return (
          <button
            key={id}
            disabled={disabled}
            aria-current={active ? 'page' : undefined}
            onClick={() => onView(id)}
          >
            <item.icon size={20} />
            <span>{id === 'jobs' ? '채용' : id === 'world' ? '리그' : item.label}</span>
            {id === 'inbox' && unread > 0 && (
              <b aria-label={`읽지 않은 메일 ${unread}개`}>{Math.min(99, unread)}</b>
            )}
          </button>
        );
      })}
      <button disabled={disabled} onClick={() => setOpenMobile(true)}>
        <Menu size={20} />
        <span>전체 메뉴</span>
      </button>
    </nav>
  );
}
