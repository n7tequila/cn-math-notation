/** 竖式的一步到位函数：原文 + 选项原文 → SVG / MathML。 */
import { parseLayout } from "./parse-layout.ts";
import { buildSemantic } from "./semantic/index.ts";
import { DEFAULT_STYLE, parseOptions, type StyleOptions } from "./options.ts";
import { renderLayout, type RenderedSvg, type RenderOptions } from "./render-svg.ts";
import { layoutToMathML, type MathMLOptions } from "./mathml.ts";

/** 直写布局一步到位：原文 + 选项原文 → SVG。base 是未写选项时的默认样式。 */
export function renderShushiLayout(
  source: string,
  options?: string,
  base: StyleOptions = DEFAULT_STYLE,
  render: RenderOptions = {},
): RenderedSvg {
  return renderLayout(parseLayout(source), parseOptions(options, base), render);
}

/** 语义式一步到位：算式（如 `403-167`）+ 选项原文 → SVG。竖式过程由程序算出。 */
export function renderShushi(
  expression: string,
  options?: string,
  base: StyleOptions = DEFAULT_STYLE,
  render: RenderOptions = {},
): RenderedSvg {
  const style = parseOptions(options, base);
  return renderLayout(buildSemantic(expression, style), style, render);
}

/** 语义式 → MathML（mstack / mlongdiv）。 */
export function shushiToMathML(
  expression: string,
  options?: string,
  base: StyleOptions = DEFAULT_STYLE,
  mathml: MathMLOptions = {},
): string {
  const style = parseOptions(options, base);
  return layoutToMathML(buildSemantic(expression, style), style, mathml);
}

/** 直写布局 → MathML。 */
export function shushiLayoutToMathML(
  source: string,
  options?: string,
  base: StyleOptions = DEFAULT_STYLE,
  mathml: MathMLOptions = {},
): string {
  const style = parseOptions(options, base);
  return layoutToMathML(parseLayout(source), style, mathml);
}
