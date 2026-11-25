/**
 * 把试写稿里的例子渲染成 out/*.svg 与 out/demo.html，用来和 docs/samples/ 的课本样本并排目测。
 * 运行：bun run demo（交互试写用 bun run playground）
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderShushiLayout } from "../packages/core/src/index.ts";
import { EXAMPLES } from "../packages/playground/src/examples.ts";

mkdirSync("out", { recursive: true });
const cards = EXAMPLES.map((ex, i) => {
  const { svg } = renderShushiLayout(ex.body, ex.options);
  const name = `${String(i + 1).padStart(2, "0")}-${ex.name.replace(/[\s/]/g, "")}`;
  writeFileSync(`out/${name}.svg`, svg.replaceAll("currentColor", "#222"));
  return `<figure><div style="font-size:32px">${svg}</div><figcaption>${ex.name}${ex.options ? `（${ex.options}）` : ""}</figcaption></figure>`;
});
writeFileSync(
  "out/demo.html",
  `<!doctype html><meta charset="utf-8"><title>cn-math-notation demo</title>
<style>body{font-family:sans-serif;display:flex;flex-wrap:wrap;gap:24px;padding:24px;color:#222;background:#fff}
figure{margin:0;padding:12px;border:1px solid #ddd;border-radius:6px}figcaption{font-size:13px;color:#666}</style>
${cards.join("\n")}`,
);
console.log(`写出 ${EXAMPLES.length} 个示例到 out/`);
