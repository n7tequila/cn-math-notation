/**
 * 小数除法竖式（样本“小数除法”，设计草案 §11.2）。整数除以整数除不尽时也走这里（默认除成小数）。
 * - 商的小数点与被除数的小数点上下对齐；小数点不占列，写在空隙里。
 * - 除数是小数：除数、被除数原来的小数点划掉，按新的小数点除（只画最终竖式）；
 *   被除数位数不够时补 0 并加框【推论】。
 * - 除到被除数末尾还有余数：添的 0 写在余数行，不补进被除数；markAppended 时它和对应的商位标红。
 *   被除数原来没有小数点时写成“×.0”（12÷50 → 12.0），第一步就要用到的 0 也写进被除数。
 * - 商的整数部分不够商 1 时写 0，小数点后不够商 1 的位也写 0（0.12÷4 = 0.03）。
 * - 除不尽（化简后的除数含 2、5 以外的因数）暂不支持，报错。
 */
import type { Cell, CellMark, Layout, Row } from "../model.ts";
import type { StyleOptions } from "../options.ts";
import { answerCells } from "./answer.ts";
import { digitCells, toGapCells, trimNum } from "./gap-point.ts";
import { ExpressionError, type Num } from "./numbers.ts";
import type { Expression } from "./parse-expr.ts";

function gcd(a: bigint, b: bigint): bigint {
  return b === 0n ? a : gcd(b, a % b);
}

/** D ÷ d 能否除尽（d 化简后只含因数 2、5）。 */
function terminates(dividend: bigint, divisor: bigint): boolean {
  let d = divisor / gcd(dividend, divisor);
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  return d === 1n;
}

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
}

/** 按位除到余数为 0 且被除数各位都用完。digits 之外的位按 0 算。 */
function divide(digits: string, divisor: bigint): Division {
  const digit = (i: number): bigint => (i < digits.length ? BigInt(digits[i]!) : 0n);
  const steps: Step[] = [];
  const zeroPos: number[] = [];
  let pos = 0;
  let cur = digit(0);
  while (cur < divisor) {
    pos += 1;
    cur = cur * 10n + digit(pos);
  }
  for (;;) {
    const q = cur / divisor;
    steps.push({ pos, value: cur, q });
    let rem = cur - q * divisor;
    if (rem === 0n && pos >= digits.length - 1) return { steps, zeroPos, lastPos: pos };
    pos += 1;
    rem = rem * 10n + digit(pos);
    while (rem < divisor) {
      zeroPos.push(pos);
      if (rem === 0n && pos >= digits.length - 1) return { steps, zeroPos, lastPos: pos };
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
  rows.push(rowOf(0n, division.lastPos, false));

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

export function decimalDivLayout(e: Expression, style: StyleOptions, process: boolean): Layout {
  if (e.remainder !== undefined) throw new ExpressionError("小数除法的答案不写余数");
  const divisor = BigInt(e.b.int + e.b.frac);
  if (divisor === 0n) throw new ExpressionError("除数不能是 0");
  const base = scaledDividend(e.a, e.b);
  const value = BigInt(base.digits);
  if (!terminates(value, divisor)) {
    throw new ExpressionError("除不尽（商是循环小数）暂不支持；整数除法要写余数请加选项 remainder");
  }
  if (value === 0n) throw new ExpressionError("被除数是 0，不用列竖式");
  const dividend = extend(base, divide(base.digits, divisor));
  const division = divide(dividend.digits, divisor);
  const built = build(dividend, divisor, division, style);

  const quotientCells =
    e.answer === undefined ? built.quotient : toGapCells(answerCells(e.answer, built.correct), dividend.places);
  const fb = e.b.frac.length;
  const dividendRow: Row = {
    kind: "digits",
    divisor: fb > 0 ? e.b.int + e.b.frac : e.b.int,
    ...(fb > 0 ? { divisorStruckPoint: e.b.int.length } : {}),
    cells: dividendCells(dividend),
  };
  const rows: Row[] = [{ kind: "digits", quotient: true, cells: quotientCells }, dividendRow];
  return { rows: process ? [...rows, ...built.rows] : rows, hasDecimal: false };
}
