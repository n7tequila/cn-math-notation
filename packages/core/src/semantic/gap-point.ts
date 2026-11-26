/**
 * 小数乘除法的“空隙小数点”：小数点不占列，记在它前面那一格的 point 上（设计草案 §11.2）。
 * 列号按整数排：数字串的最低一位在 shift 列，小数点写在第 pointAfter 列那一格的右边。
 */
import type { Cell, CellMark, PointMark } from "../model.ts";
import type { Num } from "./numbers.ts";

export interface DigitCellOptions {
  readonly shift?: number;
  /** 小数点写在哪一列的格子后面；不写则没有小数点。 */
  readonly pointAfter?: number;
  readonly point?: PointMark;
  readonly color?: string;
  readonly marksAt?: (col: number) => readonly CellMark[];
}

/** 把一串数字（可带前导 0，如 0.12 写作 "012"）写成一行格子。 */
export function digitCells(digits: string, opts: DigitCellOptions = {}): Cell[] {
  const shift = opts.shift ?? 0;
  return [...digits].map((ch, i) => {
    const col = digits.length - 1 - i + shift;
    const base: Cell = { col, content: { kind: "digit", text: ch }, marks: [...(opts.marksAt?.(col) ?? [])] };
    const colored = opts.color === undefined ? base : { ...base, color: opts.color };
    return col === opts.pointAfter ? { ...colored, point: opts.point ?? "dot" } : colored;
  });
}

/** 写出一个数：整数部分 + 小数部分连成一串，最低一位在 shift 列。 */
export function numCells(num: Num, opts: Omit<DigitCellOptions, "pointAfter"> = {}): Cell[] {
  const shift = opts.shift ?? 0;
  const pointAfter = num.frac === "" ? undefined : shift + num.frac.length;
  return digitCells(num.int + num.frac, pointAfter === undefined ? opts : { ...opts, pointAfter });
}

/**
 * 把“小数点占列”的格子（answerCells 等按 -0.5 列产出）换成空隙小数点：整数列整体加 shift，
 * 小数点并到原来个位（0 列）那一格上。
 */
export function toGapCells(cells: readonly Cell[], shift: number, point: PointMark = "dot"): Cell[] {
  const hasPoint = cells.some((c) => c.content.kind === "point");
  return cells
    .filter((c) => c.content.kind !== "point")
    .map((c) => {
      const moved: Cell = { ...c, col: c.col + shift };
      return hasPoint && c.col === 0 ? { ...moved, point } : moved;
    });
}

/** 去掉小数部分末尾的 0（比较孩子的答案时用：84.0 与 84 是同一个数）。 */
export function trimNum(num: Num): Num {
  return { int: num.int, frac: num.frac.replace(/0+$/, "") };
}
