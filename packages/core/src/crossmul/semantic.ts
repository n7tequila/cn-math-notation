/**
 * 十字相乘语义式：把 ax² + bx + c（或 ax² + bxy + cy²）拆成 (a1·x + c1)(a2·x + c2)。
 * 枚举顺序【推论】：a1 取 a 的因数从小到大；c1 取 c 的因数按绝对值从小到大、正的在前；
 * 取第一组 a1·c2 + a2·c1 = b。左列写 a1x、a2x，右列写 c1、c2（带正负号）。
 * 验算行先写左上乘右下、再写左下乘右上（设计草案 §10.3 的 3x + 2x = 5x）。
 */
import { ExpressionError } from "../semantic/numbers.ts";
import { plainTerm, type CrossMulLayout } from "./model.ts";
import type { CrossMulOptions } from "./options.ts";
import { monomial, parseQuadratic, polynomial, signed, type Quadratic } from "./poly.ts";

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function divisors(n: number): number[] {
  const m = Math.abs(n);
  const out: number[] = [];
  for (let d = 1; d <= m; d += 1) if (m % d === 0) out.push(d);
  return out;
}

interface Split {
  readonly a1: number;
  readonly a2: number;
  readonly c1: number;
  readonly c2: number;
}

function findSplit(q: Quadratic): Split | undefined {
  for (const a1 of divisors(q.a)) {
    const a2 = q.a / a1;
    for (const d of divisors(q.c)) {
      for (const c1 of [d, -d]) {
        const c2 = q.c / c1;
        if (a1 * c2 + a2 * c1 === q.b) return { a1, a2, c1, c2 };
      }
    }
  }
  return undefined;
}

function validate(q: Quadratic): void {
  if (q.a < 0) throw new ExpressionError("二次项系数是负数，请先提出负号");
  if (q.c === 0) throw new ExpressionError("没有常数项，请先提出公因式");
  const g = gcd(gcd(q.a, q.b), q.c);
  if (g > 1) throw new ExpressionError(`有公因式 ${g}，请先提出公因式`);
}

export function buildCrossMulFrom(source: string, opts: CrossMulOptions): CrossMulLayout {
  const q = parseQuadratic(source);
  validate(q);
  const split = findSplit(q);
  if (split === undefined) throw new ExpressionError("在整数范围内不能用十字相乘分解");
  const { a1, a2, c1, c2 } = split;
  const v = q.v ?? "";
  const uv = `${q.u}${v}`;
  const check = `${polynomial([[a1 * c2, uv], [a2 * c1, uv]])} = ${q.b === 0 ? "0" : monomial(q.b, uv)}`;
  const factor = (ai: number, ci: number): string => `(${polynomial([[ai, q.u], [ci, v]])})`;
  const square = (l: string): string => (l === "" ? "" : `${l}²`);
  const original = polynomial([
    [q.a, square(q.u)],
    [q.b, uv],
    [q.c, square(v)],
  ]);
  return {
    left: [plainTerm(monomial(a1, q.u)), plainTerm(monomial(a2, q.u))],
    right: [plainTerm(signed(c1, v)), plainTerm(signed(c2, v))],
    ...(opts.check ? { check: plainTerm(check) } : {}),
    ...(opts.problem ? { problem: original } : {}),
    result: opts.result ? [`${original} = ${factor(a1, c1)}${factor(a2, c2)}`] : [],
  };
}
