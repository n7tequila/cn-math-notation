/**
 * 路由（不依赖网络，便于测试）：
 *   GET  /render.svg?tex=…   GET /render.png?tex=…   POST /render（JSON）   GET /health
 * 出错时返回 JSON：{ success: false, data: null, error }。
 */
import { LIMITS, parseParams, ParamError, type ImageFormat } from "./params.ts";
import { renderImage } from "./render.ts";
import { RenderError } from "./render-error.ts";

export interface App {
  fetch(request: Request): Promise<Response>;
}

/** 同一公式同一参数出图结果不变，可以让浏览器、CDN 缓存。 */
const IMAGE_CACHE = "public, max-age=86400";

function json(status: number, data: unknown, error: string | null): Response {
  return Response.json({ success: error === null, data, error }, { status });
}

function fail(status: number, error: string): Response {
  return json(status, null, error);
}

async function image(raw: Record<string, unknown>, format: ImageFormat | undefined): Promise<Response> {
  try {
    const result = await renderImage(parseParams(raw, format));
    return new Response(result.body, {
      headers: { "content-type": result.contentType, "cache-control": IMAGE_CACHE },
    });
  } catch (e) {
    if (e instanceof ParamError || e instanceof RenderError) return fail(400, e.message);
    console.error("[cn-math-notation server] 出图失败", { tex: raw["tex"], error: e });
    return fail(500, "服务器内部错误");
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > LIMITS.maxBodyBytes) return fail(413, `请求体太大，最多 ${LIMITS.maxBodyBytes} 字节`);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "请求体应该是 JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail(400, "请求体应该是 JSON 对象");
  return body as Record<string, unknown>;
}

const GET_IMAGE_ROUTES: Readonly<Record<string, ImageFormat>> = {
  "/render.svg": "svg",
  "/render.png": "png",
};

export function createApp(): App {
  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const format = GET_IMAGE_ROUTES[url.pathname];
      if (format !== undefined) {
        if (request.method !== "GET") return fail(405, "这个地址只接受 GET");
        return image(Object.fromEntries(url.searchParams), format);
      }
      if (url.pathname === "/render") {
        if (request.method !== "POST") return fail(405, "这个地址只接受 POST");
        const body = await readJsonBody(request);
        return body instanceof Response ? body : image(body, undefined);
      }
      if (url.pathname === "/health") return json(200, { status: "ok" }, null);
      return fail(404, "没有这个地址");
    },
  };
}
