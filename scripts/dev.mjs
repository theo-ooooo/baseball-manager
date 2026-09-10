import { spawn } from 'node:child_process';
// Both sides of the preview must use the same source revision.
const children = [
  spawn(process.execPath, ['scripts/build-api.mjs', '--watch'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '--workspace', '@dugout/web'], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code || 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
