export type * from "./model.ts";
export {
  buildDengshi,
  buildDengshiLayout,
  dengshiSteps,
  dengshiTex,
  parseDengshiLines,
  parseArith,
  simplifySteps,
  arithToTex,
  type ArithNode,
  parseDengshiOptions,
  DEFAULT_DENGSHI,
  type DengshiOptions,
  type DengshiRest,
} from "./dengshi/index.ts";
export { buildSemantic, parseExpression, ExpressionError, DIGIT_COLORS, type Expression } from "./semantic/index.ts";
export { parseLayout, tokenize, assignColumns, LayoutSyntaxError } from "./parse-layout.ts";
export {
  renderLayout,
  describe,
  FONT_SIZE,
  COLORS,
  type RenderedSvg,
  type RenderOptions,
  type RootDisplay,
} from "./render-svg.ts";
export {
  DEFAULT_STYLE,
  parseOptions,
  OptionError,
  type StyleOptions,
  type CarryAt,
  type OperatorPlacement,
  type MulMode,
  type ProcessMode,
} from "./options.ts";

import { parseLayout } from "./parse-layout.ts";
import { buildSemantic } from "./semantic/index.ts";
import { DEFAULT_STYLE, parseOptions, type StyleOptions } from "./options.ts";
import { renderLayout, type RenderedSvg, type RenderOptions } from "./render-svg.ts";
import { layoutToMathML, type MathMLOptions } from "./mathml.ts";

export { layoutToMathML, type MathMLOptions } from "./mathml.ts";
export { toGapPoints } from "./point-style.ts";
export {
  buildShortDiv,
  parseShortDivLayout,
  parseShortDivOptions,
  renderShortDiv,
  renderDuanchu,
  renderDuanchuLayout,
  describeShortDiv,
  DEFAULT_SHORTDIV,
  type ShortDivLayout,
  type ShortDivRow,
  type ShortDivTerm,
  type ShortDivOptions,
} from "./shortdiv/index.ts";
export {
  buildFactorTree,
  buildFactorTreeLayout,
  parseFactorTreeLayout,
  parseFactorTreeOptions,
  renderFactorTree,
  renderShuzhuang,
  renderShuzhuangLayout,
  describeFactorTree,
  DEFAULT_FACTORTREE,
  type FactorTree,
  type FactorTreeNode,
  type FactorTreeOptions,
  type FactorSplit,
} from "./factortree/index.ts";

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
