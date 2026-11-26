/**
 * 服务端 MathJax 4：TeX → SVG 字符串。递等式（core 只产出 TeX）和普通公式都走这里。
 * SVG 里的字形是路径（fontCache: local），转 PNG 时不依赖字体；只有 \text{} 里的文字是 <text>。
 */
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import "@mathjax/src/js/util/asyncLoad/esm.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";
import { RenderError } from "./render-error.ts";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", {
  InputJax: new TeX({ packages: ["base", "ams"] }),
  OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: "local" }),
});

const ERROR_ATTR = /data-mjx-error="([^"]*)"/;
/**
 * MathJax 给字形定义编号 MJX-<计数>-<字体>-<字形>，计数每转换一次加一，同一公式每次输出都不同、没法缓存。
 * 换成固定前缀：后半段已含字体与字形名，同名定义内容一定相同，几张 SVG 内嵌在同一页面里也不冲突。
 */
const GLYPH_ID_COUNTER = /\bMJX-\d+-/g;
const STABLE_ID_PREFIX = "MJX-CMN-";

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** TeX → `<svg>…</svg>`；TeX 写错时抛 RenderError（MathJax 的报错文字）。 */
export async function texToSvg(tex: string): Promise<string> {
  const node = await doc.convertPromise(tex, { display: true });
  const svg = adaptor.innerHTML(node);
  const error = ERROR_ATTR.exec(svg);
  if (error !== null) throw new RenderError(`TeX：${decodeEntities(error[1]!)}`);
  return svg.replace(GLYPH_ID_COUNTER, STABLE_ID_PREFIX);
}
