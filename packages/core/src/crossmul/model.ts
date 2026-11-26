/** 十字相乘的模型（设计草案 §10.3）：左右两列各两项，交叉相乘；下面可写验算行与分解结果。 */
import type { CellMark } from "../model.ts";

/** 一项：已排好的文字（负号用 “−”，平方用 “²”），渲染时字母排成斜体。 */
export interface CrossTerm {
  readonly text: string;
  readonly marks: readonly CellMark[];
}

export interface CrossMulLayout {
  /** 左列：二次项拆成的两项（上、下）。 */
  readonly left: readonly [CrossTerm, CrossTerm];
  /** 右列：常数项（或 y² 项）拆成的两项（上、下）。 */
  readonly right: readonly [CrossTerm, CrossTerm];
  /** 横线下的验算行，如 3x + 2x = 5x。 */
  readonly check?: CrossTerm;
  /** 写在上方的原题（problem 选项，语义式默认开；直写没有）。 */
  readonly problem?: string;
  /** 分解结果（result 选项）。 */
  readonly result: readonly string[];
}

export function plainTerm(text: string): CrossTerm {
  return { text, marks: [] };
}
