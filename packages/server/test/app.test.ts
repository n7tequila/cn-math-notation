import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.ts";
import { LIMITS } from "../src/params.ts";

const app = createApp();
const BASE = "http://localhost";
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function get(path: string, query: Record<string, string> = {}): Promise<Response> {
  return app.fetch(new Request(`${BASE}${path}?${new URLSearchParams(query)}`));
}

function post(body: unknown, raw?: string): Promise<Response> {
  return app.fetch(
    new Request(`${BASE}/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

async function errorOf(res: Response): Promise<string> {
  const json = (await res.json()) as { success: boolean; data: unknown; error: string };
  expect(json.success).toBe(false);
  expect(json.data).toBeNull();
  return json.error;
}

describe("GET /render.svg", () => {
  test("竖式出 SVG：像素尺寸、颜色", async () => {
    const res = await get("/render.svg", { tex: String.raw`\shushi{403-167}`, color: "#336699", size: "30" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    const svg = await res.text();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toMatch(/^<svg[^>]* width="\d+(\.\d+)?" height="\d+(\.\d+)?"/);
    expect(svg).toContain("color:#336699");
    expect(svg).not.toMatch(/^<svg[^>]*width="[\d.]+em"/);
  });

  test("递等式和普通公式经 MathJax 出 SVG", async () => {
    for (const tex of [String.raw`\dengshi{[100-(20+30)]\div5}`, String.raw`\frac{1}{2}+x^2`]) {
      const res = await get("/render.svg", { tex });
      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toMatch(/^<svg[^>]*width="[\d.]+ex"/);
    }
  });

  test("同一请求每次的结果逐字节相同（MathJax 的字形编号不随调用次数变）", async () => {
    const tex = String.raw`\dengshi{[100-(20+30)]\div5}`;
    const first = await (await get("/render.svg", { tex })).text();
    await get("/render.svg", { tex: String.raw`\frac{1}{2}` });
    const second = await (await get("/render.svg", { tex })).text();
    expect(second).toBe(first);
    expect(first).not.toMatch(/MJX-\d+-/);
  });

  test("短除法、树状图、十字相乘、综合除法都能出图", async () => {
    const cases = [
      String.raw`\duanchu[result]{36, 48}`,
      String.raw`\shuzhuang{36}`,
      String.raw`\shizi{x^2+5x+6}`,
      String.raw`\zonghe{(x^2+3x+2)\div(x+1)}`,
    ];
    for (const tex of cases) expect((await get("/render.svg", { tex })).status).toBe(200);
  });

  test("写法错误返回 400 和报错文字", async () => {
    const res = await get("/render.svg", { tex: String.raw`\shushi{7+}` });
    expect(res.status).toBe(400);
    expect((await errorOf(res)).startsWith("\\shushi：")).toBe(true);
  });

  test("MathJax 报错也返回 400", async () => {
    const res = await get("/render.svg", { tex: String.raw`\frac{1}` });
    expect(res.status).toBe(400);
    expect((await errorOf(res)).length).toBeGreaterThan(0);
  });

  test("和普通公式混写返回 400", async () => {
    const res = await get("/render.svg", { tex: String.raw`x+\shushi{1+1}` });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toContain("单独");
  });

  test("参数错误返回 400", async () => {
    expect((await get("/render.svg", {})).status).toBe(400);
    expect((await get("/render.svg", { tex: "x", size: "999" })).status).toBe(400);
  });

  test("出图太大返回 400", async () => {
    const tall = Array.from({ length: 60 }, () => "1").join(String.raw` \\ `);
    const res = await get("/render.svg", { tex: String.raw`\dengshi*{${tall}}`, size: String(LIMITS.maxSize) });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toContain("太大");
  });
});

describe("GET /render.png", () => {
  test("竖式与递等式出 PNG", async () => {
    for (const tex of [String.raw`\shushi{403-167}`, String.raw`\dengshi{2\times3+1}`]) {
      const res = await get("/render.png", { tex, background: "white" });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual(PNG_MAGIC);
    }
  });
});

describe("PNG 里的中文", () => {
  test("常用字（GB2312 一级）能出 PNG", async () => {
    // 含非 ASCII 时不用 String.raw：Bun 会把汉字写成 \uXXXX 转义
    const res = await get("/render.png", { tex: "3\\text{米}+5\\text{千克}" });
    expect(res.status).toBe(200);
  });

  test("字体里没有的字：PNG 返回 400 并列出缺的字，SVG 照常", async () => {
    const tex = "\\text{鑫鑫淼}"; // GB2312 二级字
    const png = await get("/render.png", { tex });
    expect(png.status).toBe(400);
    const error = await errorOf(png);
    expect(error).toContain("鑫");
    expect(error).toContain("淼");
    expect(error).toContain("SVG");
    expect((await get("/render.svg", { tex })).status).toBe(200);
  });
});

describe("POST /render", () => {
  test("按 format 出 SVG 或 PNG", async () => {
    const svg = await post({ tex: String.raw`\shushi{74+88}` });
    expect(svg.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    const png = await post({ tex: String.raw`\shushi{74+88}`, format: "png", size: 48 });
    expect(png.headers.get("content-type")).toBe("image/png");
  });

  test("请求体不是 JSON 对象时返回 400", async () => {
    expect((await post(undefined, "not json")).status).toBe(400);
    expect((await post([1, 2])).status).toBe(400);
  });
});

describe("其他路径", () => {
  test("健康检查", async () => {
    const res = await get("/health");
    expect(await res.json()).toEqual({ success: true, data: { status: "ok" }, error: null });
  });

  test("未知路径 404，方法不对 405", async () => {
    expect((await get("/nope")).status).toBe(404);
    const res = await app.fetch(new Request(`${BASE}/render.svg`, { method: "DELETE" }));
    expect(res.status).toBe(405);
  });
});
