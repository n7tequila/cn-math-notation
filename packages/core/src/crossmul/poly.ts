/**
 * 二次三项式的解析与排版：ax² + bx + c（一个字母）或 ax² + bxy + cy²（两个字母），整系数。
 * 排版统一用 “−” 作负号、“²” 作平方，运算符两边留空格。
 */
import { ExpressionError } from "../semantic/numbers.ts";

export interface Quadratic {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  /** 主字母（平方项的字母）。 */
  readonly u: string;
  /** 第二个字母；一个字母时为 undefined（c 是常数项）。 */
  readonly v?: string;
}

function normalize(source: string): string {
  return source
    .replace(/\\nobreakspace|~|\s+|\\cdot|\\,/g, "")
    .replace(/\^\{(\d+)\}/g, "^$1")
    .replace(/²/g, "^2")
    .replace(/[−–]/g, "-");
}

/** 单项：系数 + 字母（各带次数）。 */
interface Monomial {
  readonly coef: number;
  readonly powers: ReadonlyMap<string, number>;
}

const TERM = /([+-]?)(\d*)((?:[a-zA-Z](?:\^\d+)?)*)/y;

function parseMonomials(text: string): Monomial[] {
  const out: Monomial[] = [];
  let pos = 0;
  while (pos < text.length) {
    TERM.lastIndex = pos;
    const m = TERM.exec(text);
    if (m === null || m[0] === "" || (m[2] === "" && m[3] === "")) {
      throw new ExpressionError(`看不懂这里：“${text.slice(pos)}”`);
    }
    if (pos > 0 && m[1] === "") throw new ExpressionError(`项之间要用 + 或 − 连接：“${text.slice(pos)}”`);
    const powers = new Map<string, number>();
    for (const f of m[3]!.matchAll(/([a-zA-Z])(?:\^(\d+))?/g)) {
      powers.set(f[1]!, (powers.get(f[1]!) ?? 0) + Number(f[2] ?? "1"));
    }
    const magnitude = m[2] === "" ? 1 : Number(m[2]);
    out.push({ coef: m[1] === "-" ? -magnitude : magnitude, powers });
    pos += m[0].length;
  }
  return out;
}

function degreeKey(powers: ReadonlyMap<string, number>): string {
  return [...powers.entries()]
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([l, p]) => `${l}${p}`)
    .join("");
}

export function parseQuadratic(source: string): Quadratic {
  const text = normalize(source);
  if (text === "") throw new ExpressionError("十字相乘要写一个二次三项式");
  const monomials = parseMonomials(text);
  const totals = new Map<string, { coef: number; powers: ReadonlyMap<string, number> }>();
  for (const m of monomials) {
    const key = degreeKey(m.powers);
    const prev = totals.get(key);
    totals.set(key, { coef: (prev?.coef ?? 0) + m.coef, powers: m.powers });
  }
  const letters = [...new Set(monomials.flatMap((m) => [...m.powers.keys()]))];
  const squared = (l: string): number => totals.get(`${l}2`)?.coef ?? 0;
  if (letters.length === 1) {
    const u = letters[0]!;
    const allowed = new Set([`${u}2`, `${u}1`, ""]);
    if ([...totals.keys()].some((k) => !allowed.has(k)) || squared(u) === 0) {
      throw new ExpressionError("要写成 ax² + bx + c 的样子（二次三项式）");
    }
    return { a: squared(u), b: totals.get(`${u}1`)?.coef ?? 0, c: totals.get("")?.coef ?? 0, u };
  }
  if (letters.length === 2) {
    const [p, q] = letters as [string, string];
    const cross = degreeKey(new Map([[p, 1], [q, 1]]));
    const allowed = new Set([`${p}2`, `${q}2`, cross]);
    if ([...totals.keys()].some((k) => !allowed.has(k)) || squared(p) === 0 || squared(q) === 0) {
      throw new ExpressionError("两个字母时要写成 ax² + bxy + cy² 的样子");
    }
    return { a: squared(p), b: totals.get(cross)?.coef ?? 0, c: squared(q), u: p, v: q };
  }
  throw new ExpressionError("要写成含一个或两个字母的二次三项式");
}

const MINUS = "−";

/** 系数 × 字母部分，不带正号：2x、−x、−3、xy。 */
export function monomial(coef: number, letters: string): string {
  if (letters === "") return coef < 0 ? `${MINUS}${-coef}` : String(coef);
  const sign = coef < 0 ? MINUS : "";
  const mag = Math.abs(coef);
  return `${sign}${mag === 1 ? "" : mag}${letters}`;
}

/** 带正负号的项：+2、−3、+2y。 */
export function signed(coef: number, letters: string): string {
  const body = monomial(Math.abs(coef), letters);
  return `${coef < 0 ? MINUS : "+"}${body}`;
}

/** 多项式各项（系数为 0 的略去）：x² + 5x + 6。 */
export function polynomial(terms: readonly (readonly [number, string])[]): string {
  const nonzero = terms.filter(([c]) => c !== 0);
  if (nonzero.length === 0) return "0";
  return nonzero
    .map(([c, l], i) => {
      if (i === 0) return monomial(c, l);
      return `${c < 0 ? MINUS : "+"} ${monomial(Math.abs(c), l)}`;
    })
    .join(" ");
}
