/**
 * 出图服务入口。默认只监听本机（HOST=127.0.0.1）；没有鉴权，对外开放前请放在有鉴权、限流的反向代理后面。
 *   HOST=0.0.0.0 PORT=5178 bun run src/main.ts
 */
import { createApp } from "./app.ts";
import { LIMITS } from "./params.ts";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 5178;

function readPort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT 应该是 1～65535 的整数，收到 ${raw}`);
  return port;
}

const app = createApp();
const server = Bun.serve({
  hostname: process.env["HOST"] || DEFAULT_HOST,
  port: readPort(process.env["PORT"]),
  maxRequestBodySize: LIMITS.maxBodyBytes,
  fetch: (request) => app.fetch(request),
});
console.log(`cn-math-notation 出图服务：http://${server.hostname}:${server.port}`);
