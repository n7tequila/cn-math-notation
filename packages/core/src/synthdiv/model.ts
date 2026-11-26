/** 综合除法的模型（设计草案 §5.8）：根、被除式系数、乘积行（第一格空）、结果行（最后一格是余数）。 */
import type { CellMark } from "../model.ts";

export interface SynthTerm {
  readonly text: string;
  readonly marks: readonly CellMark[];
}

export interface SynthDivLayout {
  readonly root: SynthTerm;
  readonly top: readonly SynthTerm[];
  /** 与 top 等长，第一格为 undefined（空）。 */
  readonly middle: readonly (SynthTerm | undefined)[];
  /** 与 top 等长，最后一格是余数。 */
  readonly bottom: readonly SynthTerm[];
  /** 写在上方的原题（problem 选项，语义式默认开；直写没有）。 */
  readonly problem?: string;
  readonly result: readonly string[];
}

const MINUS = "−";

export function numberTerm(n: number): SynthTerm {
  return { text: n < 0 ? `${MINUS}${-n}` : String(n), marks: [] };
}
