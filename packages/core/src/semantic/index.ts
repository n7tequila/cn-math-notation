/** 语义式入口：算式 → 布局模型（与直写布局同一模型，共用渲染器）。 */
import type { Layout } from "../model.ts";
import type { StyleOptions } from "../options.ts";
import { addLayout, subLayout } from "./add-sub.ts";
import { divLayout } from "./div.ts";
import { mulLayout } from "./mul.ts";
import { parseExpression, type Expression } from "./parse-expr.ts";
import { hasLetters } from "../math-text.ts";
import { polynomialLayout } from "../polynomial/layout.ts";

export { ExpressionError } from "./numbers.ts";
export { parseExpression, type Expression } from "./parse-expr.ts";
export { DIGIT_COLORS } from "./mul.ts";

/** 是否画计算过程：auto 时，写了孩子答案就不画（避免把程序算的过程误当成孩子写的）。 */
export function showsProcess(e: Expression, style: StyleOptions): boolean {
  if (style.process === "show") return true;
  if (style.process === "hide") return false;
  return e.answer === undefined;
}

/**
 * 算术写法里的字母：两个数字之间的 x / X 是乘号（43x37），答案与余数之间的 r / R 是余数记号（17r3），
 * 不能因此当成多项式。
 */
const ARITHMETIC_LETTERS = /(?<=\d)\s*[xXrR]\s*(?=\d)/g;

function isPolynomial(source: string): boolean {
  return hasLetters(source.replace(/\\[a-zA-Z]+/g, "").replace(ARITHMETIC_LETTERS, ""));
}

export function buildSemantic(source: string, style: StyleOptions): Layout {
  // 算式里有字母（命令名与算术写法除外）就按多项式竖式画（维护者 2026-11-26 定沿用 \shushi）
  if (isPolynomial(source)) return polynomialLayout(source, style);
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
      return divLayout(e, style, process);
  }
}
