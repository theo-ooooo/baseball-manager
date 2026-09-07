import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// This is a Node SSR smoke test, not a test of the Workers/D1 runtime.
// The real Cloudflare module is provided by Workers only after deployment.
register(`data:text/javascript,${encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers') {
      return { url: 'data:text/javascript,export const env = {};', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
`)}`, import.meta.url);

test("renders the Korean game application", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/);
  assert.match(html, /<title>DUGOUT/);
});
