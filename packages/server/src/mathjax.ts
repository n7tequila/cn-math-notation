/**
 * 服务端 MathJax 4：TeX → SVG 字符串。递等式（core 只产出 TeX）和普通公式都走这里；宏包见 tex-packages.ts。
 * SVG 里的字形是路径（fontCache: local），转 PNG 时不依赖字体；只有 \text{} 里的文字是 <text>。
 *
 * 每个请求用一份新的 MathJax 文档：\newcommand、\def、\definecolor 定义的东西存在 TeX 输入里，
 * 共用一份文档时一个请求就能改掉之后所有请求的 \frac 等命令（新建一份约 9 ms）。
 */
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import "@mathjax/src/js/util/asyncLoad/esm.js";
import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";
import { inlineEmbeddedSvg } from "@cn-math-notation/core";
import { RenderError } from "./render-error.ts";
import { sanitizeMathJaxSvg } from "./svg-sanitize.ts";
import { TEX_PACKAGES } from "./tex-packages.ts";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

function freshDocument(packages: readonly string[]) {
  return mathjax.document("", {
    InputJax: new TeX({ packages: [...packages] }),
    OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: "local" }),
  });
}

const ERROR_ATTR = /data-mjx-error="([^"]*)"/;
/**
 * 带编号（\tag、带编号的环境）时 MathJax 输出宽度 100% 的自适应结构，编号靠外层容器的宽度推到右边，
 * 单独成图时没有容器，画出来是裁掉的。图片里的编号用处不大，直接报错。
 */
const LABELED = /\sdata-labels="true"/;

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** TeX → `<svg>…</svg>`（已清理，见 svg-sanitize.ts）；TeX 写错时抛 RenderError（MathJax 的报错文字）。 */
export async function texToSvg(tex: string, packages: readonly string[] = TEX_PACKAGES): Promise<string> {
  const node = await freshDocument(packages).convertPromise(tex, { display: true });
  const svg = adaptor.innerHTML(node);
  const error = ERROR_ATTR.exec(svg);
  if (error !== null) throw new RenderError(`TeX：${decodeEntities(error[1]!)}`);
  if (LABELED.test(svg)) throw new RenderError("出图不支持公式编号，请去掉 \\tag");
  // 先清理（属性值里的 < > 被转义），再在混写留的盒子里插入本库按原命令重画的 SVG（可信内容）。
  // 反过来先插后清理时，属性值里未转义的 > 会让插入错位（2026-11-27 安全审查 C1、L1）。
  return inlineEmbeddedSvg(sanitizeMathJaxSvg(svg));
}
