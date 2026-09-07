import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DUGOUT | 월드 베이스볼 매니저",
  description: "전 세계 리그와 구단, 실명 선수와 함께하는 야구 감독 시뮬레이션.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
