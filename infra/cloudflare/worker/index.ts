/** One Cloudflare entry point for the Vinext frontend and NestJS API. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from 'vinext/server/image-optimization';
import handler from 'vinext/server/app-router-entry';
import { authenticateRequest, type AuthEnvironment } from '../auth';
import { guestCookie, isSameOriginMutation } from '../../../apps/api/src/auth/guest-session';

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(
    request: Request,
    env: Env & AuthEnvironment,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (env.AUTH_PROVIDER === 'guest' && !isSameOriginMutation(request))
      return Response.json(
        { error: '다른 사이트에서 보낸 변경 요청은 허용되지 않습니다.' },
        { status: 403 },
      );
    const authenticated = await authenticateRequest(request, env);
    request = authenticated.request;
    if (!['sites', 'guest'].includes(env.AUTH_PROVIDER || ''))
      return Response.json({ error: '저장 서비스가 설정되지 않았습니다.' }, { status: 503 });

    const respond = async () => {
      if (url.pathname.startsWith('/api/')) {
        const { default: api } = await import('../../../apps/api/.build/worker.mjs');
        return api.fetch(request, env, ctx);
      }

      if (url.pathname === '/_vinext/image') {
        const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
        return handleImageOptimization(
          request,
          {
            fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
            transformImage: async (body, { width, format, quality }) => {
              const result = await env.IMAGES.input(body)
                .transform(width > 0 ? { width } : {})
                .output({
                  format:
                    format === 'image/avif' || format === 'image/webp' || format === 'image/jpeg'
                      ? format
                      : 'image/png',
                  quality,
                });
              return result.response();
            },
          },
          allowedWidths,
        );
      }

      return handler.fetch(request, env, ctx);
    };
    const response = await respond();
    const result = new Response(response.body, response);
    if (url.pathname.startsWith('/api/') || authenticated.newSession)
      result.headers.set('Cache-Control', 'no-store');
    if (authenticated.newSession && authenticated.token && !result.headers.has('Set-Cookie'))
      result.headers.append('Set-Cookie', guestCookie(authenticated.token));
    return result;
  },
};

export default worker;
