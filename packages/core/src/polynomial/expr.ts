/**
 * 多项式竖式的算式：`(P)(Q)`、`(P)\times(Q)`、`(P)\times 3x`、`(P)\div(Q)`、`(P)÷(Q)`。
 * 多项一定要加括号；单项式可以不加。
 */
import { ExpressionError } from "../semantic/numbers.ts";
import { parsePoly } from "./poly.ts";

export interface PolyExpression {
  readonly op: "×" | "÷";
  readonly p: readonly number[];
  readonly q: readonly number[];
  readonly letter: string;
}

/** 取一个因式：括号里的内容，或到运算符为止的单项式。 */
function takeFactor(text: string): { body: string; rest: string } {
  if (text.startsWith("(")) {
    const close = text.indexOf(")");
    if (close < 0) throw new ExpressionError("括号没有配对");
    return { body: text.slice(1, close), rest: text.slice(close + 1) };
  }
  const m = /^[^()×÷/*]+/.exec(text);
  if (m === null) throw new ExpressionError(`这里应该是一个多项式：“${text}”`);
  return { body: m[0], rest: text.slice(m[0].length) };
}

export function parsePolyExpression(source: string): PolyExpression {
  const text = source
    .replace(/\\nobreakspace|~|\s+/g, "")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\left|\\right/g, "");
  if (text.includes("=")) throw new ExpressionError("多项式竖式第一版不支持写孩子的答案（=…）");
  const first = takeFactor(text);
  let rest = first.rest;
  let op: "×" | "÷";
  if (rest.startsWith("×") || rest.startsWith("*")) {
    op = "×";
    rest = rest.slice(1);
  } else if (rest.startsWith("÷") || rest.startsWith("/")) {
    op = "÷";
    rest = rest.slice(1);
  } else if (rest.startsWith("(")) {
    op = "×";
  } else {
    throw new ExpressionError("多项式竖式只做乘法 (…)(…) 和除法 (…)÷(…)");
  }
  const second = takeFactor(rest);
  if (second.rest !== "") throw new ExpressionError(`多出了“${second.rest}”`);
  const p = parsePoly(first.body);
  const q = parsePoly(second.body);
  if (p.letter !== undefined && q.letter !== undefined && p.letter !== q.letter) {
    throw new ExpressionError("多项式竖式第一版只支持一个字母");
  }
  const letter = p.letter ?? q.letter;
  if (letter === undefined) throw new ExpressionError("多项式里没有字母");
  return { op, p: p.coeffs, q: q.coeffs, letter };
}
