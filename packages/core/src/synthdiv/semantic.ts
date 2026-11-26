/**
 * 综合除法语义式（维护者 2026-11-26 定：只做除以 x − a）：
 * 第一行写被除式各项系数（缺项写 0），根 a 写在左边；b_n = c_n，b_i = c_i + a·b_{i+1}；
 * 第二行写 a·b_{i+1}，结果行最后一格是余数。
 */
import { superscript } from "../math-text.ts";
import { parsePolyExpression } from "../polynomial/expr.ts";
import { polynomial } from "../crossmul/poly.ts";
import { ExpressionError } from "../semantic/numbers.ts";
import { numberTerm, type SynthDivLayout } from "./model.ts";
import type { SynthDivOptions } from "./options.ts";

function letters(letter: string, deg: number): string {
  if (deg === 0) return "";
  return deg === 1 ? letter : `${letter}${superscript(deg)}`;
}

/** 系数（下标 = 次数）→ 排好的多项式文字。 */
function polyText(coeffs: readonly number[], letter: string): string {
  const terms = coeffs.map((c, d) => [c, letters(letter, d)] as const).reverse();
  return polynomial(terms);
}

export function buildSynthDivFrom(source: string, opts: SynthDivOptions): SynthDivLayout {
  const e = parsePolyExpression(source);
  if (e.op !== "÷") throw new ExpressionError("综合除法要写成 (被除式)\\div(x − a)");
  if (e.q.length !== 2 || e.q[1] !== 1) throw new ExpressionError("综合除法只做除以 x − a（一次项系数为 1）");
  if (e.p.length < 2) throw new ExpressionError("被除式至少要是一次式");
  const a = -e.q[0]!;
  const coeffs = [...e.p].reverse(); // 从高次到常数项
  const bottom: number[] = [];
  const middle: (number | undefined)[] = [undefined];
  coeffs.forEach((c, i) => {
    if (i === 0) {
      bottom.push(c);
      return;
    }
    const product = a * bottom[i - 1]!;
    middle.push(product);
    bottom.push(c + product);
  });
  const quotient = bottom.slice(0, -1);
  const remainder = bottom[bottom.length - 1]!;
  const n = quotient.length - 1;
  const quotientText = polynomial(quotient.map((c, i) => [c, letters(e.letter, n - i)] as const));
  return {
    root: numberTerm(a),
    top: coeffs.map(numberTerm),
    middle: middle.map((m) => (m === undefined ? undefined : numberTerm(m))),
    bottom: bottom.map(numberTerm),
    ...(opts.problem ? { problem: `(${polyText(e.p, e.letter)}) ÷ (${polyText(e.q, e.letter)})` } : {}),
    result: opts.result ? [`商 ${quotientText}，余数 ${numberTerm(remainder).text}`] : [],
  };
}
