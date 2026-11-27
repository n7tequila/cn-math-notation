export type * from "./model.ts";
export {
  buildDengshi,
  buildDengshiLayout,
  katexMixedDengshi,
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


export { layoutToMathML, type MathMLOptions } from "./mathml.ts";
export { renderShushi, renderShushiLayout, shushiToMathML, shushiLayoutToMathML } from "./shushi.ts";
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
export {
  buildCrossMul,
  parseCrossMulLayout,
  parseCrossMulOptions,
  renderCrossMul,
  renderShizi,
  renderShiziLayout,
  describeCrossMul,
  DEFAULT_CROSSMUL,
  type CrossMulLayout,
  type CrossTerm,
  type CrossMulOptions,
} from "./crossmul/index.ts";
export {
  buildSynthDiv,
  parseSynthDivLayout,
  renderSynthDiv,
  renderZonghe,
  renderZongheLayout,
  describeSynthDiv,
  parseSynthDivOptions,
  DEFAULT_SYNTHDIV,
  type SynthDivOptions,
  type SynthDivLayout,
  type SynthTerm,
} from "./synthdiv/index.ts";
export {
  parseFormulaCommand,
  mentionsFormulaCommand,
  translateFormula,
  translateFormulaMathML,
  FORMULA_COMMAND_NAMES,
  MIXED_MESSAGE,
  createMathJaxMacros,
  inlineEmbeddedSvg,
  embedMathML,
  embeddedSvgFor,
  embeddedMathMLFor,
  type FormulaFamily,
  type ParsedFormula,
  type FormulaTranslation,
  type FormulaMathMLTranslation,
  type MathJaxTexParser,
  type MathJaxTexErrorClass,
  type MathJaxMacro,
} from "./formula/index.ts";
