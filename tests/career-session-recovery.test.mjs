import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const fixtures = {
  'test:state': `export const ctx={cells:[],cursor:0,responses:[],requests:[],messages:[]};`,
  react: `import {ctx} from 'test:state';
    export const useMemo=f=>f();
    export function useRef(initial){const i=ctx.cursor++;return ctx.cells[i]??=( {current:initial} );}
    export function useState(initial){const i=ctx.cursor++;if(!(i in ctx.cells))ctx.cells[i]=typeof initial==='function'?initial():initial;
      return [ctx.cells[i],v=>{ctx.cells[i]=typeof v==='function'?v(ctx.cells[i]):v;}];}`,
  sonner: `import {ctx} from 'test:state';export const toast={error:m=>ctx.messages.push(m)};`,
  './career-slot': `import {ctx} from 'test:state';export async function careerFetch(url,options){ctx.requests.push({url,options});const response=ctx.responses.shift();if(response instanceof Error)throw response;if(!response)throw Error('Unexpected request');return response;}`,
  '../inbox/use-inbox-read-queue': `export const useInboxReadQueue=()=>({viewed:new Set()});`,
  './career-memory': `export const careerMemory={career:()=>{},inbox:{snapshot:()=>new Set()}};`,
};
const built = await build({
  stdin: {
    contents:
      "export {ctx} from 'test:state';export {useCareerSession} from './apps/web/src/features/career/use-career-session';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  plugins: [
    {
      name: 'hook-transport-fixture',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (a) =>
          Object.hasOwn(fixtures, a.path) ? { path: a.path, namespace: 'fixture' } : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({
          contents: fixtures[a.path],
          loader: 'js',
        }));
      },
    },
  ],
});
const { ctx, useCareerSession } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const initial = {
  revision: 2,
  state: { club: 'kbo-kia', news: [], roster: [], budget: 50 },
  ledger: [],
};
const RenderSession = () => {
  ctx.cursor = 0;
  return useCareerSession(initial);
};
const reset = () => {
  ctx.cells = [];
  ctx.responses = [];
  ctx.requests = [];
  ctx.messages = [];
  return RenderSession();
};

test('A known game-rule rejection keeps the saved career healthy and the corrected command gets a new id', async () => {
  let h = reset();
  ctx.responses.push(Response.json({ error: '중요한 새 보고를 확인해 주세요.' }, { status: 400 }));
  assert.equal(await h.act({ type: 'beginSeriesDelegation' }), null);
  h = RenderSession();
  assert.equal(h.saveFailed, false);
  assert.equal(h.g, initial.state);
  assert.equal(ctx.messages.at(-1), '중요한 새 보고를 확인해 주세요.');
  ctx.responses.push(Response.json({ ...initial, revision: 3 }));
  await h.act({ type: 'beginSeriesDelegation' });
  const payloads = ctx.requests.map((r) => JSON.parse(r.options.body));
  assert.notEqual(payloads[0].requestId, payloads[1].requestId);
  assert.equal(RenderSession().saveFailed, false);
});
test('A lost response retains the same retry id and a successful retry clears the uncertain-save warning', async () => {
  let h = reset();
  ctx.responses.push(new TypeError('Network interrupted'));
  await h.act({ type: 'delegateSeriesDay' });
  h = RenderSession();
  assert.equal(h.saveFailed, true);
  ctx.responses.push(Response.json({ ...initial, revision: 3 }));
  await h.act({ type: 'delegateSeriesDay' });
  assert.deepEqual(
    JSON.parse(ctx.requests[0].options.body),
    JSON.parse(ctx.requests[1].options.body),
  );
  assert.equal(RenderSession().saveFailed, false);
});
test('Malformed success responses and failed reloads keep the warning until an actual reload succeeds', async () => {
  let h = reset();
  ctx.responses.push(
    new Response('truncated', { headers: { 'content-type': 'application/json' } }),
  );
  await h.act({ type: 'continueDay' });
  h = RenderSession();
  assert.equal(h.saveFailed, true);
  ctx.responses.push(new TypeError('Offline'));
  await h.load();
  h = RenderSession();
  assert.equal(h.saveFailed, true);
  assert.ok(h.error);
  ctx.responses.push(Response.json({ ...initial, revision: 3 }));
  await h.load();
  h = RenderSession();
  assert.equal(h.saveFailed, false);
  assert.equal(h.error, '');
});
test('A resolved revision conflict installs the authoritative state and does not claim a failed save', async () => {
  let h = reset();
  ctx.responses.push(new TypeError('Lost response'));
  await h.act({ type: 'continueDay' });
  h = RenderSession();
  assert.equal(h.saveFailed, true);
  const current = { ...initial, revision: 4, state: { ...initial.state, day: 3 } };
  ctx.responses.push(
    Response.json({ ...current, error: '저장 버전이 변경됐습니다.' }, { status: 409 }),
  );
  await h.act({ type: 'continueDay' });
  h = RenderSession();
  assert.equal(h.g.day, 3);
  assert.equal(h.saveFailed, false);
});
