/** 语义式入口：算式 → 布局模型（与直写布局同一模型，共用渲染器）。 */
import type { Layout } from "../model.ts";
import type { StyleOptions } from "../options.ts";
import { addLayout, subLayout } from "./add-sub.ts";
import { divLayout } from "./div.ts";
import { mulLayout } from "./mul.ts";
import { parseExpression, type Expression } from "./parse-expr.ts";

export { ExpressionError } from "./numbers.ts";
export { parseExpression, type Expression } from "./parse-expr.ts";
export { DIGIT_COLORS } from "./mul.ts";

/** 是否画计算过程：auto 时，写了孩子答案就不画（避免把程序算的过程误当成孩子写的）。 */
export function showsProcess(e: Expression, style: StyleOptions): boolean {
  if (style.process === "show") return true;
  if (style.process === "hide") return false;
  return e.answer === undefined;
}

export function buildSemantic(source: string, style: StyleOptions): Layout {
  const e = parseExpression(source);
  const process = showsProcess(e, style);
  switch (e.op) {
    case "+":
      return addLayout(e, style, process);
    case "-":
      return subLayout(e, style, process);
    case "×":
      return mulLayout(e, style, process);
    case "÷":
      return divLayout(e, process);
  }
}
