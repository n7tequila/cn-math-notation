/**
 * 生成 README 与使用说明里的演示图：docs/images/<id>.svg。
 * GitHub 无法渲染 \shushi，所以文档用图片展示。白底 + 固定墨色，深色主题下也看得清。
 * 运行：bun run docs:images
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderShushi, renderShushiLayout, type RenderedSvg } from "../packages/core/src/index.ts";
import { EXAMPLES, SEMANTIC_EXAMPLES, type Example } from "../packages/playground/src/examples.ts";

const INK = "#1f2a44";
const OUT = "docs/images";

/** 额外的对照图：同一道题的不同样式。 */
const VARIANTS: readonly Example[] = [
  { id: "add-carry-sw", name: "加法进位 左下", body: EXAMPLES[0]!.body, options: "carryAt=sw" },
  { id: "add-carry-noguides", name: "加法 不画数位虚线", body: EXAMPLES[0]!.body, options: "guides=false" },
];

function toDocSvg(svg: string, width: number, height: number): string {
  const withInk = svg.replaceAll("currentColor", INK);
  const openEnd = withInk.indexOf(">") + 1;
  const background = `<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#ffffff"/>`;
  return withInk.slice(0, openEnd) + background + withInk.slice(openEnd);
}

function write(id: string, out: RenderedSvg): void {
  writeFileSync(`${OUT}/${id}.svg`, toDocSvg(out.svg, out.width, out.height) + "\n");
}

mkdirSync(OUT, { recursive: true });
for (const ex of [...EXAMPLES, ...VARIANTS]) write(ex.id, renderShushiLayout(ex.body, ex.options));
for (const ex of SEMANTIC_EXAMPLES) write(ex.id, renderShushi(ex.expr, ex.options));
console.log(`写出 ${EXAMPLES.length + VARIANTS.length + SEMANTIC_EXAMPLES.length} 张图到 ${OUT}/`);
