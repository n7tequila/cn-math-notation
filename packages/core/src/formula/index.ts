/**
 * 整个公式 → 怎么渲染：给不能注册新命令的公式引擎（Typora 的 MathJax、出图服务等）用。
 * 本库命令单独写成一个公式时由本库画 SVG，递等式转成 TeX，其余放行。
 */
export {
  parseFormulaCommand,
  mentionsFormulaCommand,
  FORMULA_COMMAND_NAMES,
  MIXED_MESSAGE,
  type FormulaFamily,
  type ParsedFormula,
} from "./command.ts";
export {
  translateFormula,
  translateFormulaMathML,
  type FormulaTranslation,
  type FormulaMathMLTranslation,
} from "./translate.ts";
export {
  createMathJaxMacros,
  inlineEmbeddedSvg,
  embedMathML,
  embeddedSvgFor,
  embeddedMathMLFor,
  type MathJaxTexParser,
  type MathJaxTexErrorClass,
  type MathJaxMacro,
} from "./mathjax-embed.ts";
