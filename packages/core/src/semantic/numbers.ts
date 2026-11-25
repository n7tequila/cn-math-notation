/**
 * 语义式用的十进制数工具：按“列号”取位、生成格子。列号约定同 model.ts（个位 0，小数点 -0.5）。
 * 运算一律用 bigint 定点数，避免浮点误差。
 */
import type { Cell, CellMark } from "../model.ts";

export class ExpressionError extends Error {
  override readonly name = "ExpressionError";
}

/** 非负十进制数：整数部分（无前导 0，0 写作 "0"）与小数部分（原样保留，可带尾随 0）。 */
export interface Num {
  readonly int: string;
  readonly frac: string;
}

export function parseNum(text: string): Num {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (m === null) throw new ExpressionError(`"${text}" 不是数字`);
  return { int: m[1]!.replace(/^0+(?=\d)/, ""), frac: m[2] ?? "" };
}

/** 定点整数：value = num × 10^places（places ≥ num 的小数位数）。 */
export function scaled(num: Num, places: number): bigint {
  return BigInt(num.int + num.frac.padEnd(places, "0"));
}

/** 定点整数 → Num，保留 places 位小数。 */
export function fromScaled(value: bigint, places: number): Num {
  const s = value.toString().padStart(places + 1, "0");
  const int = s.slice(0, s.length - places).replace(/^0+(?=\d)/, "");
  return { int, frac: places === 0 ? "" : s.slice(s.length - places) };
}

/** 第 col 列的数字（整数列 ≥ 0，小数列 < 0）；超出范围为 0。 */
export function digitAt(num: Num, col: number): number {
  if (col >= 0) {
    const i = num.int.length - 1 - col;
    return i >= 0 ? Number(num.int[i]) : 0;
  }
  const j = -col - 1;
  return j < num.frac.length ? Number(num.frac[j]) : 0;
}

export function highestCol(num: Num): number {
  return num.int.length - 1;
}

export interface CellOptions {
  /** 显示几位小数；超出原有小数位数的部分补 0。默认按原样。 */
  readonly places?: number;
  /** 补出来的 0 是否加“补 0”标记。 */
  readonly markPadded?: boolean;
  /** 整体左移的列数（乘法部分积）。 */
  readonly shift?: number;
  readonly color?: string;
  /** 给某一列的格子追加标记。 */
  readonly marksAt?: (col: number) => readonly CellMark[];
}

/** 把数写成一行格子。 */
export function cellsOf(num: Num, opts: CellOptions = {}): Cell[] {
  const places = opts.places ?? num.frac.length;
  const shift = opts.shift ?? 0;
  const cells: Cell[] = [];
  const make = (col: number, content: Cell["content"], extra: readonly CellMark[] = []): Cell => {
    const marks = [...extra, ...(opts.marksAt?.(col) ?? [])];
    return opts.color === undefined ? { col, content, marks } : { col, content, marks, color: opts.color };
  };
  for (let i = 0; i < num.int.length; i += 1) {
    const col = num.int.length - 1 - i + shift;
    cells.push(make(col, { kind: "digit", text: num.int[i]! }));
  }
  if (places > 0) {
    cells.push(make(-0.5, { kind: "point" }));
    for (let j = 0; j < places; j += 1) {
      const padded = j >= num.frac.length;
      const text = padded ? "0" : num.frac[j]!;
      cells.push(make(-(j + 1), { kind: "digit", text }, padded && opts.markPadded === true ? ["bu"] : []));
    }
  }
  return cells;
}

/** 进位行的格子：每个 [列, 数字]。 */
export function carryCells(carries: ReadonlyMap<number, number>, color?: string): Cell[] {
  return [...carries.entries()]
    .sort(([a], [b]) => b - a)
    .map(([col, d]) => {
      const content = { kind: "digit" as const, text: String(d) };
      return color === undefined ? { col, content, marks: [] } : { col, content, marks: [], color };
    });
}

export function formatNum(num: Num): string {
  return num.frac === "" ? num.int : `${num.int}.${num.frac}`;
}
