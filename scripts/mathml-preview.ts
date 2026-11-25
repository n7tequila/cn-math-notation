/**
 * 把例子导出的 MathML 放进一个页面，用 W3C 官方 polyfill（elem-math）渲染，人工核对导出是否正确。
 * 主流浏览器不原生渲染 mstack / mlongdiv，所以只能借 polyfill 看效果。
 * 运行：bun run mathml:preview，然后用浏览器打开 out/mathml-preview.html
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { shushiLayoutToMathML, shushiToMathML } from "../packages/core/src/index.ts";
import { EXAMPLES, SEMANTIC_EXAMPLES } from "../packages/playground/src/examples.ts";

/** 固定到某个提交，避免 polyfill 更新导致预览变化。 */
const POLYFILL = "https://cdn.jsdelivr.net/gh/w3c/mathml-polyfills@38bd8d9ce2bf9117e9e4db3dfbdbc1c5fa55ba48";

const cards = [
  ...SEMANTIC_EXAMPLES.map((ex) => [ex.name + "（语义式）", shushiToMathML(ex.expr, ex.options)] as const),
  ...EXAMPLES.map((ex) => [ex.name + "（直写）", shushiLayoutToMathML(ex.body, ex.options)] as const),
  ...SEMANTIC_EXAMPLES.filter((ex) => /×|\\times/.test(ex.expr) || ex.expr.includes("+")).map(
    (ex) => [ex.name + "（进位写上方 carries=above）", shushiToMathML(ex.expr, ex.options, undefined, { carries: "above" })] as const,
  ),
].map(([name, mathml]) => `<figure><div class="m">${mathml}</div><figcaption>${name}</figcaption></figure>`);

mkdirSync("out", { recursive: true });
writeFileSync(
  "out/mathml-preview.html",
  `<!doctype html><meta charset="utf-8"><title>MathML 导出预览</title>
<style>body{font-family:sans-serif;display:flex;flex-wrap:wrap;gap:20px;padding:20px;background:#fff;color:#222}
figure{margin:0;padding:12px 18px;border:1px solid #ddd;border-radius:6px}.m{font-size:28px}figcaption{font-size:12px;color:#666}</style>
<script type="module">
import { _MathTransforms } from "${POLYFILL}/common/math-transforms.js";
import "${POLYFILL}/elem-math/elemMath.js";
window.addEventListener("load", () => { _MathTransforms.transform(document.body); document.body.dataset.done = "1"; });
</script>
${cards.join("\n")}`,
);
console.log(`写出 ${cards.length} 个 MathML 例子到 out/mathml-preview.html`);
