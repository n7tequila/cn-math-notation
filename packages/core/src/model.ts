/**
 * 竖式布局模型（第一期：整数与小数竖式、长除法）。
 *
 * 列号：个位为 0，向高位为正，向小数位为负；小数点本身占 -0.5 这一“窄列”（加减法）。
 * 小数乘除法的小数点不占列，记在前一格的 point 上，列号按整数排（最低一位为 0 附近）。
 * 设计依据：docs/design/2026-11-19-设计草案.md §3、§11。
 */

export type CellMark = "tui" | "err" | "hong" | "bu" | "hua";

export type CellContent =
  | { readonly kind: "digit"; readonly text: string }
  | { readonly kind: "point" }
  /** 多项式竖式的一项（如 +3x、x²），整项占一格；列号 = 次数（设计草案 §5.7）。 */
  | { readonly kind: "term"; readonly text: string }
  | { readonly kind: "blank" };

/**
 * 写在这一格右边空隙里的小数点（小数乘除法：小数点不占列，设计草案 §11.2）。
 * dot 普通；hong 标红（markPoint）；hua 原来的小数点被划掉（除数是小数时）。
 */
export type PointMark = "dot" | "hong" | "hua";

export interface Cell {
  readonly col: number;
  readonly content: CellContent;
  readonly marks: readonly CellMark[];
  readonly color?: string;
  readonly point?: PointMark;
  /** 空隙小数点的颜色（直写里 \textcolor{…}{.}），不写时按 point 取黑色或标红。 */
  readonly pointColor?: string;
}

export type Operator = "+" | "-" | "×" | "÷";

/** 普通数字行（加数、部分积、结果、除法各步）。 */
export interface DigitRow {
  readonly kind: "digits";
  readonly cells: readonly Cell[];
  readonly operator?: Operator;
  /** 长除法：商行。 */
  readonly quotient?: true;
  /** 长除法：被除数行，带除数。 */
  readonly divisor?: string;
  /** 除数里被划掉的小数点：写在第几个字符之后（除数是小数、化成整数时）。 */
  readonly divisorStruckPoint?: number;
}

/** 进位行：每个数字记在“进到的那一列”。 */
export interface CarryRow {
  readonly kind: "carry";
  readonly cells: readonly Cell[];
}

/** 横线：画在前一行与后一行之间。 */
export interface RuleRow {
  readonly kind: "hline";
}

export type Row = DigitRow | CarryRow | RuleRow;

export interface Layout {
  readonly rows: readonly Row[];
  /** 是否出现过小数点（决定按小数点对齐、是否画数位虚线等）。 */
  readonly hasDecimal: boolean;
}
