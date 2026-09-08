import 'reflect-metadata';
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
  app.useBodyParser('json', { limit: '12kb' });
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(3000);
  return app;
}
const ready = bootstrap();
const bridge = httpServerHandler({ port: 3000 });
const worker = {
  async fetch(request: Request, environment?: unknown, context?: unknown): Promise<Response> {
    const origin = request.headers.get('origin');
    if (request.method !== 'GET' && origin && origin !== new URL(request.url).origin)
      return Response.json({ error: '요청 출처를 확인할 수 없습니다.' }, { status: 403 });
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.includes('application/json'))
        return Response.json({ error: 'JSON 요청이 필요합니다.' }, { status: 415 });
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > 12000)
        return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
      try {
        JSON.parse(body);
      } catch {
        return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      request = new Request(request, { body });
    }
    await ready;
    const response = await bridge.fetch(request, environment, context);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  },
};

export default worker;
