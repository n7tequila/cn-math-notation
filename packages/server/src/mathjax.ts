/**
 * 服务端 MathJax 4：TeX → SVG 字符串。递等式（core 只产出 TeX）和普通公式都走这里；宏包见 tex-packages.ts。
 * SVG 里的字形是路径（fontCache: local），转 PNG 时不依赖字体；只有 \text{} 里的文字是 <text>。
 */
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import "@mathjax/src/js/util/asyncLoad/esm.js";
import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";
import { RenderError } from "./render-error.ts";
import { TEX_PACKAGES } from "./tex-packages.ts";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", {
  InputJax: new TeX({ packages: [...TEX_PACKAGES] }),
  OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: "local" }),
});

const ERROR_ATTR = /data-mjx-error="([^"]*)"/;
/**
 * MathJax 给字形定义编号 MJX-<计数>-<字体>-<字形>，计数每转换一次加一，同一公式每次输出都不同、没法缓存。
 * 换成固定前缀：后半段已含字体与字形名，同名定义内容一定相同，几张 SVG 内嵌在同一页面里也不冲突。
 */
const GLYPH_ID_COUNTER = /\bMJX-\d+-/g;
const STABLE_ID_PREFIX = "MJX-CMN-";
/**
 * MathJax 把公式原文抄进 data-latex 属性，但 lite 适配器不转义属性里的 < >，
 * a<b 这样的公式会得到非法 XML（浏览器打不开、resvg 报错）。图片用不着这个属性，直接去掉。
 */
const LATEX_ATTR = /\sdata-latex="[^"]*"/g;

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
  return svg.replace(LATEX_ATTR, "").replace(GLYPH_ID_COUNTER, STABLE_ID_PREFIX);
}
