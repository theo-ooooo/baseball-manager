import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../apps/web/dist', import.meta.url));
const target = fileURLToPath(new URL('../dist', import.meta.url));
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log('Staged the combined Worker and assets in dist.');
