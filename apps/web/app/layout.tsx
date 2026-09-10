import type { Metadata } from 'next';
import '../styles/globals.css';
import '../styles/management.css';
import '../styles/replay.css';
import '../styles/match-preparation.css';
import '../styles/interface.css';
import '../styles/roster.css';
import '../styles/dashboard.css';
import '../styles/calendar-progress.css';
import '../styles/negotiations.css';
import '../styles/development.css';
import '../styles/contracts.css';
import '../styles/scouting.css';
import '../styles/inbox.css';
import '../styles/mobile-match.css';
import '../styles/manager-flow.css';
import '../styles/action-progress.css';
import '../styles/match-media.css';
import '../styles/career-office.css';
import '../styles/player-portrait.css';
import '../styles/season-start.css';
import '../styles/app-version.css';
import '../styles/league-records.css';
import '../styles/match-center.css';
import '../styles/training-center.css';
import '../styles/clubhouse-theme.css';
import '../styles/workspace-layout.css';
import '../styles/registrations.css';
import '../styles/overlays.css';
import { DialogViewport } from '../src/features/career/dialog-viewport';

export const metadata: Metadata = {
  title: 'DUGOUT | 월드 베이스볼 매니저',
  description: '전 세계 리그와 구단, 실명 선수와 함께하는 야구 감독 시뮬레이션.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <DialogViewport />
        {children}
      </body>
    </html>
  );
}
