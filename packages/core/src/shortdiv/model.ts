/**
 * 短除法的布局模型（设计草案 §5.6、§10.5）。每个数整个占一格（不按位拆），各列按个位对齐。
 */
import type { CellMark } from "../model.ts";

export interface ShortDivTerm {
  readonly text: string;
  readonly marks: readonly CellMark[];
  readonly color?: string;
}

/** 有除数的行画“除数 | 数……”加下方横线；最后一行只有商、不画线。 */
export interface ShortDivRow {
  readonly divisor?: ShortDivTerm;
  readonly values: readonly ShortDivTerm[];
}

export interface ShortDivLayout {
  readonly rows: readonly ShortDivRow[];
  /** 写在下面的结果算式（result 选项）。 */
  readonly result: readonly string[];
}

export function term(text: string): ShortDivTerm {
  return { text, marks: [] };
}
