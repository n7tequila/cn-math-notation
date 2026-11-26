/**
 * 多项式竖式（设计草案 §5.7，维护者 2026-11-26 定沿用 \shushi）：
 * - 乘法：第二个因式从低次项起，每项乘第一个因式写一行、按次数错位，再相加【推论】；只有一项时那一行就是积。
 * - 长除法：括号与整数长除法相同；商的每一项写在被除式同次项上方；每步写乘积、横线，
 *   减完后把余下的各项都写出来；最后一行是余式（除尽写 0）【推论】。商的系数须为整数。
 * - coefficients（分离系数法）：只写系数，缺项写 0。
 */
import type { Layout, Row } from "../model.ts";
import type { StyleOptions } from "../options.ts";
import { ExpressionError } from "../semantic/numbers.ts";
import { parsePolyExpression } from "./expr.ts";
import { degree, monomialPoly, multiply, polyCells, polyText, subtract, type RowOptions } from "./poly.ts";

function mulRows(p: readonly number[], q: readonly number[], opts: RowOptions): Row[] {
  const rows: Row[] = [
    { kind: "digits", cells: polyCells(p, opts) },
    { kind: "digits", operator: "×", cells: polyCells(q, opts) },
    { kind: "hline" },
  ];
  const partials = q.flatMap((c, k) => (c === 0 ? [] : [multiply(p, monomialPoly(c, k))]));
  for (const partial of partials) rows.push({ kind: "digits", cells: polyCells(partial, opts) });
  if (partials.length === 1) return rows;
  return [...rows, { kind: "hline" }, { kind: "digits", cells: polyCells(multiply(p, q), opts) }];
}

function divRows(p: readonly number[], d: readonly number[], opts: RowOptions): Row[] {
  const dd = degree(d);
  if (dd < 1) throw new ExpressionError("除式至少要是一次式");
  if (degree(p) < dd) throw new ExpressionError("被除式的次数比除式低，不用列竖式");
  const lead = d[dd]!;
  const steps: Row[] = [];
  const quotient = new Array<number>(degree(p) - dd + 1).fill(0);
  let rest = [...p];
  let first = true;
  while (degree(rest) >= dd && !(degree(rest) === 0 && rest[0] === 0)) {
    const k = degree(rest) - dd;
    const top = rest[degree(rest)]!;
    if (top % lead !== 0) throw new ExpressionError("商的系数不是整数，第一版只做整系数");
    const t = top / lead;
    quotient[k] = t;
    const product = multiply(d, monomialPoly(t, k));
    if (!first) steps.push({ kind: "digits", cells: polyCells(rest, { ...opts, low: 0 }) });
    steps.push({ kind: "digits", cells: polyCells(product, opts) }, { kind: "hline" });
    rest = subtract(rest, product);
    first = false;
  }
  steps.push({ kind: "digits", cells: polyCells(rest, { ...opts, low: 0 }) });
  return [
    { kind: "digits", quotient: true, cells: polyCells(quotient, { ...opts, low: 0 }) },
    { kind: "digits", divisor: polyText(d, opts.letter, opts.coefficients), cells: polyCells(p, { ...opts, low: 0 }) },
    ...steps,
  ];
}

export function polynomialLayout(source: string, style: StyleOptions): Layout {
  const e = parsePolyExpression(source);
  const opts: RowOptions = { letter: e.letter, coefficients: style.coefficients };
  const rows = e.op === "×" ? mulRows(e.p, e.q, opts) : divRows(e.p, e.q, opts);
  return { rows, hasDecimal: false };
}
