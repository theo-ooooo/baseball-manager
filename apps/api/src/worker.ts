import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { httpServerHandler } from 'cloudflare:node';
import { AppModule } from './app.module';

class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
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
    response
      .status(status)
      .json({ ...body, error: body.state !== undefined ? body.error : message });
  }
}
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    logger: false,
    bodyParser: false,
  });
  // Requests are authenticated and byte-limited before entering the HTTP bridge.
  app.useBodyParser('json', { limit: '8mb' });
  app.useGlobalFilters(new ApiExceptionFilter());
  // Workers uses this as a routing key. A fresh key also isolates Vite module reloads.
  await app.listen(0);
  const { port } = app.getHttpServer().address() as AddressInfo;
  const fetch = httpServerHandler({ port }).fetch;
  if (!fetch) throw new Error('Cloudflare HTTP bridge is missing its fetch handler');
  return { app, fetch };
}
// SSR and static requests must not start NestJS or open the HTTP bridge.
let ready: ReturnType<typeof bootstrap> | undefined;
function application() {
  return (ready ??= bootstrap().catch((error) => {
    ready = undefined;
    throw error;
  }));
}
const hot = (import.meta as ImportMeta & { hot?: { dispose(cleanup: () => void): void } }).hot;
if (hot) hot.dispose(() => void ready?.then(({ app }) => app.close()));
const worker = {
  async fetch(
    request: Request<unknown, IncomingRequestCfProperties>,
    environment: unknown,
    context: ExecutionContext,
  ): Promise<Response> {
    const origin = request.headers.get('origin');
    if (request.method !== 'GET' && origin && origin !== new URL(request.url).origin)
      return Response.json({ error: '요청 출처를 확인할 수 없습니다.' }, { status: 403 });
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.includes('application/json'))
        return Response.json({ error: 'JSON 요청이 필요합니다.' }, { status: 415 });
      const body = await request.text();
      const isTransfer =
        new URL(request.url).pathname === '/api/career/import' &&
        request.headers.get('x-dugout-transfer') === 'import';
      const limit = isTransfer ? 8 * 1024 * 1024 : 12000;
      if (new TextEncoder().encode(body).byteLength > limit)
        return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
      try {
        JSON.parse(body);
      } catch {
        return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      request = new Request<unknown, IncomingRequestCfProperties>(request, { body });
    }
    const bridge = await application();
    const response = await bridge.fetch(request, environment, context);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  },
};

export default worker;
