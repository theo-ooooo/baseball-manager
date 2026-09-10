import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { HttpException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { CareerController } from './controllers/career.controller';
import { CareerTransferController } from './controllers/career-transfer.controller';
import { CatalogController } from './controllers/catalog.controller';
import { HealthController } from './controllers/health.controller';
import { SessionController } from './controllers/session.controller';
import { PlayerRecordsController } from './controllers/player-records.controller';
import type { ApiRequest } from './auth/api-request';

// Nest owns dependency injection and all controllers/services. Workers already provides HTTP;
// avoid wrapping every request in a Node HTTP server, Express streams and a second JSON parser.
let ready: ReturnType<typeof NestFactory.createApplicationContext> | undefined;
function application() {
  return (ready ??= NestFactory.createApplicationContext(AppModule, { logger: false }).catch(
    (error) => {
      ready = undefined;
      throw error;
    },
  ));
}
const hot = (import.meta as ImportMeta & { hot?: { dispose(cleanup: () => void): void } }).hot;
if (hot) hot.dispose(() => void ready?.then((app) => app.close()));

function failure(error: unknown) {
  const status = error instanceof HttpException ? error.getStatus() : 503;
  const detail = error instanceof HttpException ? error.getResponse() : null;
  const body = typeof detail === 'object' && detail ? (detail as Record<string, unknown>) : {};
  const message =
    typeof detail === 'string'
      ? detail
      : body.message ||
        body.error ||
        '저장 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  if (status === 503)
    console.error(
      'API operation failed',
      error instanceof Error ? error.message : 'Unknown database failure',
    );
  return Response.json(
    { ...body, error: body.state !== undefined ? body.error : message },
    { status },
  );
}
async function dispatch(request: Request): Promise<Response> {
  const url = new URL(request.url),
    method = request.method;
  const origin = request.headers.get('origin');
  if (method !== 'GET' && method !== 'HEAD' && origin && origin !== url.origin)
    return Response.json({ error: '요청 출처를 확인할 수 없습니다.' }, { status: 403 });
  let body: unknown;
  if (method === 'POST') {
    if (!request.headers.get('content-type')?.includes('application/json'))
      return Response.json({ error: 'JSON 요청이 필요합니다.' }, { status: 415 });
    const transfer =
      url.pathname === '/api/career/import' &&
      request.headers.get('x-dugout-transfer') === 'import';
    const limit = transfer ? 8 * 1024 * 1024 : 12000;
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader)
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > limit) {
          await reader.cancel();
          return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
        }
        chunks.push(part.value);
      }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    if (url.pathname === '/api/career') {
      const action =
        body && typeof body === 'object' && !Array.isArray(body)
          ? (body as Record<string, unknown>).type
          : undefined;
      console.info(
        'career-action',
        typeof action === 'string' && /^[a-zA-Z]{1,50}$/.test(action) ? action : 'invalid',
      );
    }
  }
  const app = await application();
  const input: ApiRequest = { headers: Object.fromEntries(request.headers), body };
  const headers = new Headers();
  let result: unknown,
    status = 200;
  const path = url.pathname.replace(/\/$/, '');
  const get = method === 'GET' || method === 'HEAD';
  const parameter = (prefix: string) => {
    try {
      return decodeURIComponent(path.slice(prefix.length));
    } catch {
      throw new BadRequestException('식별자 형식이 올바르지 않습니다.');
    }
  };
  if (get && path === '/api/health') result = await app.get(HealthController).health();
  else if (get && path === '/api/catalog') result = await app.get(CatalogController).world(input);
  else if (get && path === '/api/career') result = await app.get(CareerController).career(input);
  else if (method === 'POST' && path === '/api/career') {
    result = await app.get(CareerController).action(input);
    status = 201;
  } else if (get && path.startsWith('/api/career/matches/') && !path.slice(20).includes('/'))
    result = await app.get(CareerController).match(input, parameter('/api/career/matches/'));
  else if (get && path === '/api/career/export')
    result = await app.get(CareerTransferController).backup(input);
  else if (method === 'POST' && path === '/api/career/import')
    result = await app.get(CareerTransferController).restore(input);
  else if (get && path === '/api/session') result = app.get(SessionController).current(input);
  else if (method === 'POST' && path === '/api/session')
    result = await app
      .get(SessionController)
      .restore(input, { setHeader: (name, value) => headers.set(name, value) });
  else if (get && path === '/api/records/retired')
    result = await app
      .get(PlayerRecordsController)
      .retired(input, url.searchParams.get('offset') || '0');
  else if (get && path.startsWith('/api/records/') && !path.slice(13).includes('/'))
    result = await app.get(PlayerRecordsController).records(input, parameter('/api/records/'));
  else throw new NotFoundException('요청한 API를 찾을 수 없습니다.');
  if (method === 'HEAD') return new Response(null, { status, headers });
  return Response.json(result, { status, headers });
}
const worker = {
  async fetch(request: Request): Promise<Response> {
    let response: Response;
    try {
      response = await dispatch(request);
    } catch (error) {
      response = failure(error);
    }
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  },
};

export default worker;
