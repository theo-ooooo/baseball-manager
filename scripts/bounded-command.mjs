import { spawn } from 'node:child_process';
const [, , duration, command, ...args] = process.argv;
const match = /^(\d+)(ms|s|m)?$/.exec(duration || '');
if (!match || !command)
  throw new Error('Usage: bounded-command.mjs <timeout: 3m> <command> [args]');
const ms = Number(match[1]) * { ms: 1, s: 1000, m: 60000 }[match[2] || 'ms'];
const child = spawn(command, args, { stdio: 'inherit', detached: process.platform !== 'win32' });
const signal = (sig) => {
  try {
    if (process.platform === 'win32') child.kill(sig);
    else process.kill(-child.pid, sig);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
};
let expired = false,
  killTimer;
const timer = setTimeout(() => {
  expired = true;
  signal('SIGTERM');
  killTimer = setTimeout(() => signal('SIGKILL'), 10000);
}, ms);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => signal(sig));
child.on('error', (error) => {
  clearTimeout(timer);
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  clearTimeout(timer);
  clearTimeout(killTimer);
  process.exitCode = expired ? 124 : (code ?? 1);
});
