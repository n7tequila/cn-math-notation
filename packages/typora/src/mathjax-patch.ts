/**
 * 包住 Typora 调用的三个 MathJax 入口（Typora 1.14 实测：公式块、行内公式、悬浮预览、目录、导出都走这三个）：
 * - tex2svg / tex2svgPromise：本库命令由本库画 SVG，递等式转成 TeX 再交给 MathJax，其余原样交给 MathJax；
 * - tex2mml：“复制为 MathML / 复制到 Word”用，竖式给 mstack，其余同上。
 *
 * Typora 改公式设置时会重新加载 MathJax，入口函数随之换新；用函数上的标记判断是否已经包过。
 */
import type { RenderedSvg } from "@cn-math-notation/core";
import { translateFormula, translateFormulaMathML } from "@cn-math-notation/core";

export interface MathJaxOptions {
  readonly display?: boolean;
  readonly [key: string]: unknown;
}

type Tex2Svg = (tex: string, options?: MathJaxOptions) => Element;
type Tex2SvgPromise = (tex: string, options?: MathJaxOptions) => Promise<Element>;
type Tex2Mml = (tex: string, options?: MathJaxOptions) => string;

/** 本插件用到的 MathJax 最小接口。 */
export interface MathJaxLike {
  tex2svg?: Tex2Svg;
  tex2svgPromise?: Tex2SvgPromise;
  tex2mml?: Tex2Mml;
}

/** 把本库的渲染结果做成 Typora 认得的元素（DOM 部分单独放，便于测试）。 */
export interface ElementFactory {
  svg(rendered: RenderedSvg, display: boolean): Element;
  error(message: string, display: boolean): Element;
}

const PATCHED = Symbol.for("cn-math-notation.typora.patched");

interface Marked {
  [PATCHED]?: true;
}

export function isPatched(mj: MathJaxLike): boolean {
  return (mj.tex2svg as Marked | undefined)?.[PATCHED] === true;
}

/** MathJax 的 display 默认是 true（块级）。 */
function isDisplay(options: MathJaxOptions | undefined): boolean {
  return options?.display ?? true;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mark<F extends object>(fn: F): F {
  (fn as Marked)[PATCHED] = true;
  return fn;
}

/**
 * 包住 mj 的入口函数，返回还原函数。三个入口缺一个（MathJax 还没加载完）就不包、返回空操作。
 * 已经包过的不再重复包。
 */
export function patchMathJax(mj: MathJaxLike, factory: ElementFactory): () => void {
  const { tex2svg, tex2svgPromise, tex2mml } = mj;
  if (tex2svg === undefined || tex2svgPromise === undefined || tex2mml === undefined) return () => {};
  if (isPatched(mj)) return () => {};

  const toElement = (tex: string, options: MathJaxOptions | undefined): Element | { readonly tex: string } | undefined => {
    const r = translateFormula(tex);
    switch (r.kind) {
      case "pass":
        return undefined;
      case "tex":
        return { tex: r.tex };
      case "svg":
        return factory.svg(r.rendered, isDisplay(options));
      case "error":
        return factory.error(r.message, isDisplay(options));
    }
  };

  const patchedSvg = mark<Tex2Svg>((tex, options) => {
    const r = toElement(tex, options);
    if (r === undefined) return tex2svg(tex, options);
    return "tex" in r ? tex2svg(r.tex, options) : r;
  });
  const patchedPromise = mark<Tex2SvgPromise>(async (tex, options) => {
    const r = toElement(tex, options);
    if (r === undefined) return tex2svgPromise(tex, options);
    return "tex" in r ? tex2svgPromise(r.tex, options) : r;
  });
  const patchedMml = mark<Tex2Mml>((tex, options) => {
    const r = translateFormulaMathML(tex);
    switch (r.kind) {
      case "pass":
        return tex2mml(tex, options);
      case "tex":
        return tex2mml(r.tex, options);
      case "mathml":
        return r.mathml;
      case "error":
        return `<math xmlns="http://www.w3.org/1998/Math/MathML"><merror><mtext>${escapeXml(r.message)}</mtext></merror></math>`;
    }
  });

  mj.tex2svg = patchedSvg;
  mj.tex2svgPromise = patchedPromise;
  mj.tex2mml = patchedMml;

  return () => {
    // 只还原自己包的那一层：如果 MathJax 已被重新加载、入口换了新的，就不动它
    if (mj.tex2svg === patchedSvg) mj.tex2svg = tex2svg;
    if (mj.tex2svgPromise === patchedPromise) mj.tex2svgPromise = tex2svgPromise;
    if (mj.tex2mml === patchedMml) mj.tex2mml = tex2mml;
  };
}
