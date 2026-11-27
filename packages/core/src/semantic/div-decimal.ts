/**
 * 小数除法竖式（样本“小数除法”，设计草案 §11.2）。整数除以整数除不尽时也走这里（默认除成小数）。
 * - 商的小数点与被除数的小数点上下对齐；小数点不占列，写在空隙里。
 * - 除数是小数：除数、被除数原来的小数点划掉，按新的小数点除（只画最终竖式）；
 *   被除数位数不够时补 0 并加框【推论】。
 * - 除到被除数末尾还有余数：添的 0 写在余数行，不补进被除数；markAppended 时它和对应的商位标红。
 *   被除数原来没有小数点时写成“×.0”（12÷50 → 12.0），第一步就要用到的 0 也写进被除数。
 * - 商的整数部分不够商 1 时写 0，小数点后不够商 1 的位也写 0（0.12÷4 = 0.03）。
 * - 商是循环小数（维护者 2026-11-27）：默认除到循环节完整一遍且至少 3 位，商后面写省略号，最后一行写余数；
 *   places=N 除到第 N 位；repeatDot 只除一个循环节，在循环节首尾数字上打循环点。
 * - 求商的近似值 round=N：竖式除到第 N+1 位，下面写“≈ 近似值”（四舍五入，末尾的 0 照写）；
 *   本来就能除尽、且小数位数不超过 N 时照常画。
 * - 循环小数、近似值的孩子答案暂不支持。
 */
import type { Cell, CellMark, Layout, Row } from "../model.ts";
import { MAX_PLACES, type StyleOptions } from "../options.ts";
import { answerCells } from "./answer.ts";
import { digitCells, toGapCells, trimNum } from "./gap-point.ts";
import { ExpressionError, type Num } from "./numbers.ts";
import type { Expression } from "./parse-expr.ts";

/** 商的小数部分：不循环部分 pre 位、循环节 period 位（period 为 0 表示能除尽，pre 即小数位数）。 */
interface Expansion {
  readonly pre: number;
  readonly period: number;
}

/** value ÷ (divisor × 10^places) 的小数展开；limit 位以内还定不下来时返回 undefined。 */
function expansion(value: bigint, divisor: bigint, places: number, limit: number): Expansion | undefined {
  const m = divisor * 10n ** BigInt(places);
  const seen = new Map<bigint, number>();
  let r = value % m;
  for (let k = 0; k <= limit; k += 1) {
    if (r === 0n) return { pre: k, period: 0 };
    const at = seen.get(r);
    if (at !== undefined) return { pre: at, period: k - at };
    seen.set(r, k);
    r = (r * 10n) % m;
  }
  return undefined;
}

/** 竖式除到商的第几位小数停下；exact 表示除尽为止。 */
type Plan =
  | { readonly mode: "exact" }
  | { readonly mode: "recurring"; readonly digits: number; readonly cycle?: Expansion }
  | { readonly mode: "round"; readonly digits: number; readonly keep: number };

function plan(exp: Expansion | undefined, style: StyleOptions): Plan {
  if (style.round !== undefined) {
    const exactFits = exp !== undefined && exp.period === 0 && exp.pre <= style.round;
    return exactFits ? { mode: "exact" } : { mode: "round", digits: style.round + 1, keep: style.round };
  }
  if (exp !== undefined && exp.period === 0) return { mode: "exact" };
  if (style.repeatDot) {
    if (exp === undefined) throw new ExpressionError(`循环节太长（超过 ${MAX_PLACES} 位），不能打循环点`);
    const length = exp.pre + exp.period;
    if (style.places !== undefined && style.places < length) {
      throw new ExpressionError(`places=${style.places} 不够写出一个循环节（要 ${length} 位）`);
    }
    return { mode: "recurring", digits: style.places ?? length, cycle: exp };
  }
  if (style.places !== undefined) return { mode: "recurring", digits: style.places };
  if (exp === undefined) {
    throw new ExpressionError(`循环节太长（超过 ${MAX_PLACES} 位），请用 places 写明除到第几位小数`);
  }
  return { mode: "recurring", digits: Math.max(MIN_RECURRING_PLACES, exp.pre + exp.period) };
}

/** 循环小数默认至少除到第 3 位，让孩子看得出在重复（维护者 2026-11-27）。 */
const MIN_RECURRING_PLACES = 3;

/** 一步：位置 pos（被除数第 pos 位，超出写下的被除数即为添的 0）。 */
interface Step {
  readonly pos: number;
  /** 这一步落位后得到的数（第一步为被除数的前几位），pos 处商 q。 */
  readonly value: bigint;
  readonly q: bigint;
}

interface Division {
  readonly steps: Step[];
  /** 商为 0、不写乘积的位置。 */
  readonly zeroPos: number[];
  readonly lastPos: number;
  /** 最后一行写的余数（除尽时为 0）。 */
  readonly remainder: bigint;
}

/**
 * 按位除到余数为 0 且被除数各位都用完；给了 stopPos 时除到这一位就停（循环小数、近似值）。
 * digits 之外的位按 0 算。
 */
function divide(digits: string, divisor: bigint, stopPos?: number): Division {
  const digit = (i: number): bigint => (i < digits.length ? BigInt(digits[i]!) : 0n);
  const done = (rem: bigint, pos: number): boolean =>
    stopPos === undefined ? rem === 0n && pos >= digits.length - 1 : pos >= stopPos;
  const steps: Step[] = [];
  const zeroPos: number[] = [];
  let pos = 0;
  let cur = digit(0);
  while (cur < divisor) {
    if (stopPos !== undefined && pos >= stopPos) throw new ExpressionError("除到这一位商还是 0，请多保留几位小数");
    pos += 1;
    cur = cur * 10n + digit(pos);
  }
  for (;;) {
    const q = cur / divisor;
    steps.push({ pos, value: cur, q });
    let rem = cur - q * divisor;
    if (done(rem, pos)) return { steps, zeroPos, lastPos: pos, remainder: rem };
    pos += 1;
    rem = rem * 10n + digit(pos);
    while (rem < divisor) {
      zeroPos.push(pos);
      if (done(rem, pos)) return { steps, zeroPos, lastPos: pos, remainder: rem };
      pos += 1;
      rem = rem * 10n + digit(pos);
    }
    cur = rem;
  }
}

/** 被除数（已乘 10 的若干次方化成整数除数之后）。 */
interface Dividend {
  /** 写下的数字串（含为对齐补的 0、为“×.0”添的 0）。 */
  readonly digits: string;
  /** 小数位数：小数点写在第 places 列那一格的后面（0 表示不写小数点）。 */
  readonly places: number;
  /** 补的 0（除数位数多于被除数小数位数时）的个数，在最右边，加框。 */
  readonly padded: number;
  /** 被划掉的原小数点写在哪一列后面。 */
  readonly struckAfter?: number;
}

function scaledDividend(a: Num, b: Num): Dividend {
  const fa = a.frac.length;
  const fb = b.frac.length;
  const padded = Math.max(0, fb - fa);
  const digits = a.int + a.frac + "0".repeat(padded);
  const base = { digits, places: Math.max(0, fa - fb), padded };
  return fa > 0 && fb > 0 ? { ...base, struckAfter: fa + padded } : base;
}

/** 第一步就要用到写下的被除数之外的位、或要往下除小数而被除数没有小数点：往被除数后面添 0。 */
function extend(dividend: Dividend, division: Division): Dividend {
  const n = dividend.digits.length;
  const firstPos = division.steps[0]!.pos;
  const needed = Math.max(firstPos - (n - 1), dividend.places === 0 && division.lastPos > n - 1 ? 1 : 0, 0);
  if (needed === 0) return dividend;
  const moved = dividend.struckAfter === undefined ? {} : { struckAfter: dividend.struckAfter + needed };
  return { ...dividend, ...moved, digits: dividend.digits + "0".repeat(needed), places: dividend.places + needed };
}

function dividendCells(dividend: Dividend): Cell[] {
  const cells = digitCells(dividend.digits, {
    marksAt: (col) => (col < dividend.padded ? ["bu"] : []),
    ...(dividend.places > 0 ? { pointAfter: dividend.places } : {}),
  });
  if (dividend.struckAfter === undefined || dividend.struckAfter === dividend.places) return cells;
  return cells.map((c) => (c.col === dividend.struckAfter ? { ...c, point: "hua" } : c));
}

interface Built {
  readonly quotient: Cell[];
  readonly rows: Row[];
  readonly correct: Num;
}

function build(dividend: Dividend, divisor: bigint, division: Division, style: StyleOptions): Built {
  const n = dividend.digits.length;
  const colOf = (pos: number): number => n - 1 - pos;
  const appended = (pos: number): boolean => style.markAppended && pos >= n;
  const rowOf = (value: bigint, pos: number, markLowest: boolean): Row => ({
    kind: "digits",
    cells: digitCells(value.toString(), {
      shift: colOf(pos),
      marksAt: (col): readonly CellMark[] => (markLowest && col === colOf(pos) ? ["hong"] : []),
    }),
  });

  const rows: Row[] = [];
  division.steps.forEach((step, k) => {
    if (k > 0) rows.push(rowOf(step.value, step.pos, appended(step.pos)));
    rows.push(rowOf(step.q * divisor, step.pos, false), { kind: "hline" });
  });
  rows.push(rowOf(division.remainder, division.lastPos, false));

  const digitsByCol = new Map<number, { d: bigint; pos: number }>();
  for (const s of division.steps) digitsByCol.set(colOf(s.pos), { d: s.q, pos: s.pos });
  for (const p of division.zeroPos) digitsByCol.set(colOf(p), { d: 0n, pos: p });
  const high = Math.max(...digitsByCol.keys(), dividend.places);
  const low = colOf(division.lastPos);
  let text = "";
  const quotient: Cell[] = [];
  for (let col = high; col >= low; col -= 1) {
    const entry = digitsByCol.get(col) ?? { d: 0n, pos: n - 1 - col };
    text += entry.d.toString();
    const marks: CellMark[] = appended(entry.pos) ? ["hong"] : [];
    const cell: Cell = { col, content: { kind: "digit", text: entry.d.toString() }, marks };
    quotient.push(col === dividend.places && low < dividend.places ? { ...cell, point: "dot" } : cell);
  }
  const intLen = high - Math.max(dividend.places, low) + 1;
  const correct = trimNum({
    int: text.slice(0, intLen).replace(/^0+(?=\d)/, ""),
    frac: low < dividend.places ? text.slice(intLen) : "",
  });
  return { quotient, rows, correct };
}

/** 商的格子：循环小数加省略号或循环点。 */
function decorateQuotient(cells: Cell[], p: Plan, places: number, style: StyleOptions): Cell[] {
  if (p.mode !== "recurring") return cells;
  if (style.repeatDot && p.cycle !== undefined) {
    const { pre, period } = p.cycle;
    const dotted = new Set([places - (pre + 1), places - (pre + period)]);
    return cells.map((c) => (dotted.has(c.col) ? { ...c, marks: [...c.marks, "xun"] } : c));
  }
  const low = Math.min(...cells.map((c) => c.col));
  return [...cells, { col: low - 1, content: { kind: "ellipsis" }, marks: [] }];
}

/** “≈ 近似值”一行：四舍五入保留 keep 位，末尾的 0 照写；小数点与商的小数点对齐。 */
function approxRow(value: bigint, divisor: bigint, base: Dividend, keep: number, places: number): Row {
  const m = divisor * 10n ** BigInt(base.places);
  const scaledUp = value * 10n ** BigInt(keep);
  const rounded = (2n * scaledUp + m) / (2n * m);
  const digits = rounded.toString().padStart(keep + 1, "0");
  const cells = digitCells(digits, { shift: places - keep, ...(keep > 0 ? { pointAfter: places } : {}) });
  return { kind: "digits", operator: "≈", cells };
}

export function decimalDivLayout(e: Expression, style: StyleOptions, process: boolean): Layout {
  if (e.remainder !== undefined) throw new ExpressionError("小数除法的答案不写余数");
  const divisor = BigInt(e.b.int + e.b.frac);
  if (divisor === 0n) throw new ExpressionError("除数不能是 0");
  const base = scaledDividend(e.a, e.b);
  const value = BigInt(base.digits);
  if (value === 0n) throw new ExpressionError("被除数是 0，不用列竖式");
  const p = plan(expansion(value, divisor, base.places, MAX_PLACES), style);
  if (p.mode !== "exact" && e.answer !== undefined) throw new ExpressionError("循环小数、近似值的答案暂不支持");
  // 除到商的第 digits 位小数：这一位在被除数串里的位置（添 0 后不变）
  const stopPos = p.mode === "exact" ? undefined : base.digits.length - 1 - base.places + p.digits;
  const dividend = extend(base, divide(base.digits, divisor, stopPos));
  const division = divide(dividend.digits, divisor, stopPos);
  const built = build(dividend, divisor, division, style);

  const quotientCells =
    e.answer === undefined
      ? decorateQuotient(built.quotient, p, dividend.places, style)
      : toGapCells(answerCells(e.answer, built.correct), dividend.places);
  const fb = e.b.frac.length;
  const dividendRow: Row = {
    kind: "digits",
    divisor: fb > 0 ? e.b.int + e.b.frac : e.b.int,
    ...(fb > 0 ? { divisorStruckPoint: e.b.int.length } : {}),
    cells: dividendCells(dividend),
  };
  const rows: Row[] = [{ kind: "digits", quotient: true, cells: quotientCells }, dividendRow];
  const approx = p.mode === "round" ? [approxRow(value, divisor, base, p.keep, dividend.places)] : [];
  return { rows: [...rows, ...(process ? built.rows : []), ...approx], hasDecimal: false };
}
