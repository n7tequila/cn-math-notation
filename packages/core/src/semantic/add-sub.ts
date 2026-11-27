/** 加法、减法竖式（整数与小数）。 */
import type { Cell, Layout, Row } from "../model.ts";
import type { StyleOptions } from "../options.ts";
import { answerCells } from "./answer.ts";
import {
  ExpressionError,
  carryCells,
  cellsOf,
  digitAt,
  fromScaled,
  highestCol,
  scaled,
  type Num,
} from "./numbers.ts";
import type { Expression } from "./parse-expr.ts";
import { trimNum } from "./gap-point.ts";

function places(e: Expression): number {
  return Math.max(e.a.frac.length, e.b.frac.length);
}

/** 补的 0 也是程序加上的，和进位、退位点一样归 process 管（维护者 2026-11-25 定）。 */
function shownPlaces(num: Num, all: number, style: StyleOptions, process: boolean): number {
  return style.padZero && process ? all : num.frac.length;
}

function layoutOf(rows: Row[]): Layout {
  return { rows, hasDecimal: rows.some((r) => r.kind !== "hline" && r.cells.some((c) => c.content.kind === "point")) };
}

/** 结果末尾连续的 0 所在的小数列（如 4.60 → {-2}，6.00 → {-1, -2}）。 */
function trailingZeroCols(num: Num): Set<number> {
  const cols = new Set<number>();
  for (let j = num.frac.length - 1; j >= 0 && num.frac[j] === "0"; j -= 1) cols.add(-(j + 1));
  return cols;
}

function resultRow(correct: Num, e: Expression, p: number, style: StyleOptions): Row {
  // 与乘除法一致：答案省略末尾的 0（4.6、5）不算错，比对前先去掉正确结果末尾的 0
  if (e.answer !== undefined) return { kind: "digits", cells: answerCells(e.answer, trimNum(correct)) };
  const struck = style.strikeZero ? trailingZeroCols(correct) : new Set<number>();
  const cells: Cell[] = cellsOf(correct, { places: p, marksAt: (col) => (struck.has(col) ? ["hua"] : []) });
  return { kind: "digits", cells };
}

export function addLayout(e: Expression, style: StyleOptions, process = true): Layout {
  const p = places(e);
  const sum = fromScaled(scaled(e.a, p) + scaled(e.b, p), p);
  const carries = new Map<number, number>();
  let carry = 0;
  for (let col = -p; col <= Math.max(highestCol(e.a), highestCol(e.b)); col += 1) {
    const s = digitAt(e.a, col) + digitAt(e.b, col) + carry;
    carry = s >= 10 ? 1 : 0;
    if (carry > 0) carries.set(col + 1, carry);
  }
  const rows: Row[] = [
    { kind: "digits", cells: cellsOf(e.a, { places: shownPlaces(e.a, p, style, process), markPadded: true }) },
    { kind: "digits", operator: "+", cells: cellsOf(e.b, { places: shownPlaces(e.b, p, style, process), markPadded: true }) },
  ];
  if (process && style.carry && carries.size > 0) rows.push({ kind: "carry", cells: carryCells(carries) });
  rows.push({ kind: "hline" }, resultRow(sum, e, p, style));
  return layoutOf(rows);
}

export function subLayout(e: Expression, style: StyleOptions, process = true): Layout {
  const p = places(e);
  const a = scaled(e.a, p);
  const b = scaled(e.b, p);
  if (a < b) throw new ExpressionError("被减数比减数小，小学竖式不处理负数结果");
  const borrowed = new Set<number>();
  let borrow = 0;
  for (let col = -p; col <= highestCol(e.a); col += 1) {
    const d = digitAt(e.a, col) - borrow - digitAt(e.b, col);
    borrow = d < 0 ? 1 : 0;
    if (borrow > 0) borrowed.add(col + 1); // 向高一位借，高一位打退位点
  }
  const diff = fromScaled(a - b, p);
  const rows: Row[] = [
    {
      kind: "digits",
      cells: cellsOf(e.a, {
        places: shownPlaces(e.a, p, style, process),
        markPadded: true,
        marksAt: (col) => (process && borrowed.has(col) ? ["tui"] : []),
      }),
    },
    { kind: "digits", operator: "-", cells: cellsOf(e.b, { places: shownPlaces(e.b, p, style, process), markPadded: true }) },
    { kind: "hline" },
    resultRow(diff, e, p, style),
  ];
  return layoutOf(rows);
}
