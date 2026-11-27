/**
 * 一元整系数多项式：解析、运算与排版成竖式的一行。
 * 系数数组下标 = 次数（coeffs[2] 是 x² 的系数）；列号也 = 次数，所以各行天然按同次项对齐。
 */
import type { Cell } from "../model.ts";
import { superscript } from "../math-text.ts";
import { ExpressionError } from "../semantic/numbers.ts";

export interface Poly {
  readonly coeffs: readonly number[];
}

/** 去掉高次的 0 系数。 */
export function trim(coeffs: readonly number[]): number[] {
  const out = [...coeffs];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
}

export function degree(p: readonly number[]): number {
  return trim(p).length - 1;
}

function normalize(source: string): string {
  return source
    .replace(/\\nobreakspace|~|\s+|\\cdot|\\,/g, "")
    .replace(/\^\{(\d+)\}/g, "^$1")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[−–]/g, "-");
}

const TERM = /([+-]?)(\d*)([a-zA-Z]*)(?:\^(\d+))?/y;

/** 解析一个多项式，返回系数与字母（没有字母时 letter 为 undefined）。 */
/** 最高次数：系数数组按次数展开、乘法是平方复杂度，次数太大会卡住渲染。课本里远到不了这个次数【推论】。 */
const MAX_DEGREE = 20;

export function parsePoly(source: string): { coeffs: number[]; letter: string | undefined } {
  const text = normalize(source);
  if (text === "") throw new ExpressionError("多项式是空的");
  const coeffs: number[] = [];
  let letter: string | undefined;
  let pos = 0;
  while (pos < text.length) {
    TERM.lastIndex = pos;
    const m = TERM.exec(text);
    if (m === null || m[0] === "" || (m[2] === "" && m[3] === "")) throw new ExpressionError(`看不懂这里：“${text.slice(pos)}”`);
    if (pos > 0 && m[1] === "") throw new ExpressionError(`项之间要用 + 或 − 连接：“${text.slice(pos)}”`);
    const letters = m[3]!;
    if (letters.length > 1 || (letter !== undefined && letters !== "" && letters !== letter)) {
      throw new ExpressionError("多项式竖式第一版只支持一个字母");
    }
    if (letters === "" && m[4] !== undefined) throw new ExpressionError(`数字不能写次数：“${m[0]}”`);
    if (letters !== "") letter = letters;
    const deg = letters === "" ? 0 : Number(m[4] ?? "1");
    if (deg > MAX_DEGREE) throw new ExpressionError(`次数 ${deg} 太大（最高 ${MAX_DEGREE} 次）`);
    const magnitude = m[2] === "" ? 1 : Number(m[2]);
    while (coeffs.length <= deg) coeffs.push(0);
    coeffs[deg] = coeffs[deg]! + (m[1] === "-" ? -magnitude : magnitude);
    pos += m[0].length;
  }
  return { coeffs: trim(coeffs), letter };
}

export function multiply(p: readonly number[], q: readonly number[]): number[] {
  const out = new Array<number>(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j] = out[i + j]! + a * b)));
  return trim(out);
}

export function subtract(p: readonly number[], q: readonly number[]): number[] {
  const n = Math.max(p.length, q.length);
  return trim(Array.from({ length: n }, (_, i) => (p[i] ?? 0) - (q[i] ?? 0)));
}

/** 单项式 c·x^k 的系数数组。 */
export function monomialPoly(c: number, k: number): number[] {
  return [...new Array<number>(k).fill(0), c];
}

const MINUS = "−";

/** 一项的文字：first 为这一行的第一项（正数不写 +）；coefficients 时只写系数。 */
export function termText(coef: number, deg: number, letter: string, first: boolean, coefficients: boolean): string {
  const sign = coef < 0 ? MINUS : first ? "" : "+";
  const mag = Math.abs(coef);
  if (coefficients) return `${sign}${mag}`;
  if (deg === 0) return `${sign}${mag}`;
  const power = deg === 1 ? "" : superscript(deg);
  return `${sign}${mag === 1 ? "" : mag}${letter}${power}`;
}

export interface RowOptions {
  readonly letter: string;
  readonly coefficients: boolean;
  /** 分离系数法时写到第几次（缺项写 0）；默认写到最低的非零项。 */
  readonly low?: number;
}

/** 多项式写成竖式的一行：列号 = 次数；缺项留空，分离系数法写 0。 */
export function polyCells(p: readonly number[], opts: RowOptions): Cell[] {
  const coeffs = trim(p);
  const high = coeffs.length - 1;
  if (high === 0 && coeffs[0] === 0) return [{ col: 0, content: { kind: "term", text: "0" }, marks: [] }];
  const lowestNonzero = coeffs.findIndex((c) => c !== 0);
  const low = opts.coefficients ? Math.min(opts.low ?? lowestNonzero, lowestNonzero) : lowestNonzero;
  const cells: Cell[] = [];
  for (let d = high; d >= low; d -= 1) {
    const c = coeffs[d] ?? 0;
    if (c === 0 && !opts.coefficients) continue;
    const text = termText(c, d, opts.letter, cells.length === 0, opts.coefficients);
    cells.push({ col: d, content: { kind: "term", text }, marks: [] });
  }
  return cells;
}

/** 多项式写成一串文字（除式用）：x+1、x−1；分离系数法 1−1。 */
export function polyText(p: readonly number[], letter: string, coefficients: boolean): string {
  return polyCells(p, { letter, coefficients, low: 0 })
    .map((c) => (c.content.kind === "term" ? c.content.text : ""))
    .join("");
}
