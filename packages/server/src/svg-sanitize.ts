/**
 * 清理 MathJax 输出的 SVG，使它能安全地直接返回给调用方（浏览器直接打开、内嵌进网页、转 PNG）。
 * 只处理 MathJax 的输出；core 画的 SVG 不含用户文本以外的属性，不经过这里。
 *
 * lite 适配器序列化属性时会把 " 转成 &quot;，但不转义 < >；多个宏包会把用户写的文字原样抄进属性
 * （\color 的颜色、\unicode 的字体、\bbox 的 CSS、\mmlToken 的任意属性）。所以：
 * - 去掉 data-latex（公式原文，图片用不上）；
 * - 所有属性值里的 < > 转义，保证是合法 XML；
 * - 去掉指向外部的 href / xlink:href（\mmlToken 能生成 <a href="javascript:…">），只留 #MJX-… 字形引用；
 * - style 里带 url( / expression( / @import / 反斜杠 / 字符实体的声明整条删掉（\bbox 能写任意 CSS）；
 * - 字形编号 MJX-<计数>- 换成固定前缀，同一公式每次输出相同（后半段已含字体与字形名，同名定义内容一定相同）。
 */

const LATEX_ATTR = /\sdata-latex="[^"]*"/g;
const ATTR = /(\s[\w:.-]+=")([^"]*)"/g;
const EXTERNAL_HREF = /\s(?:xlink:)?href="(?!#)[^"]*"/g;
const STYLE_ATTR = /(\sstyle=")([^"]*)"/g;
/** 危险的 CSS：外部资源、旧 IE 表达式、@import；反斜杠与字符实体可用来拼出前几种，一并拒绝。 */
const UNSAFE_CSS = /url\s*\(|expression\s*\(|@import|\\|&#|&[a-z]+;/i;
const GLYPH_ID_COUNTER = /\bMJX-\d+-/g;
const STABLE_ID_PREFIX = "MJX-CMN-";

function escapeAngleBrackets(svg: string): string {
  return svg.replace(ATTR, (_, head: string, value: string) => `${head}${value.replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`);
}

function safeStyles(svg: string): string {
  return svg.replace(STYLE_ATTR, (_, head: string, value: string) => {
    const kept = value
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d !== "" && !UNSAFE_CSS.test(d.replace(/&quot;/g, '"')));
    return kept.length === 0 ? "" : `${head}${kept.join("; ")};"`;
  });
}

export function sanitizeMathJaxSvg(svg: string): string {
  const withoutLatex = svg.replace(LATEX_ATTR, "");
  const escaped = escapeAngleBrackets(withoutLatex);
  const withoutLinks = escaped.replace(EXTERNAL_HREF, "");
  const styled = safeStyles(withoutLinks);
  return styled.replace(GLYPH_ID_COUNTER, STABLE_ID_PREFIX);
}
