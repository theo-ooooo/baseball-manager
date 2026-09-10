import { version } from '../../../../package.json';

declare const __DUGOUT_BUILD__: string;

// Vite injects the same release revision into the server and browser builds.
const build = typeof __DUGOUT_BUILD__ === 'string' ? __DUGOUT_BUILD__ : 'local';

export function AppVersion({ details = false }: { details?: boolean }) {
  return (
    <span
      className={`app-version${details ? ' app-version-details' : ''}`}
      aria-label={`게임 버전 ${version}${details ? ` · 빌드 ${build}` : ''}`}
      title={`DUGOUT v${version} · 빌드 ${build}`}
    >
      <span>DUGOUT v{version}</span>
      {details && <span>빌드 {build}</span>}
    </span>
  );
}
