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
  return svg;
}
