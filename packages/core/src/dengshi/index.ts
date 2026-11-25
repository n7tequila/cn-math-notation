/**
 * 递等式：等号悬在算式左边（维护者 2026-11-26 定），各行算式左端对齐，第一行不写等号。
 * 排版交给 TeX 的 aligned 环境（第一列放等号、右对齐，第二列放算式、左对齐），
 * 所以本模块只产出 TeX 字符串，KaTeX、MathJax 都能排。
 */
import { ExpressionError } from "../semantic/numbers.ts";
import { parseArith, simplifySteps, toTex } from "./expr.ts";

export { parseArith, simplifySteps, toTex as arithToTex, type Node as ArithNode } from "./expr.ts";

/** 行距，与课本里每步一行的疏朗程度接近。 */
const ROW_GAP = "6pt";

/** 把若干行算式（不含等号）排成递等式的 TeX。 */
export function dengshiTex(lines: readonly string[]): string {
  if (lines.length === 0) throw new ExpressionError("递等式至少要有一行");
  const rows = lines.map((line, i) => (i === 0 ? `&${line}` : `={}&${line}`));
  return `\\begin{aligned}${rows.join(`\\\\[${ROW_GAP}]`)}\\end{aligned}`;
}

/** 语义式：只写算式，按运算顺序逐步化简，每一步一行。返回每行的 TeX（不含等号）。 */
export function dengshiSteps(expression: string): string[] {
  return simplifySteps(parseArith(expression)).map(toTex);
}

/** 语义式一步到位：算式 → 递等式 TeX。 */
export function buildDengshi(expression: string): string {
  return dengshiTex(dengshiSteps(expression));
}

/**
 * 直写：`25\times(40+4) \\ 25\times44 \\ 1100`，用 `\\` 分行，每行一步。
 * 行首写不写等号都可以（写了会去掉，统一由排版加上悬在左边的等号）。
 */
export function parseDengshiLines(source: string): string[] {
  const lines = source
    .split(/\\\\(?:\[[^\]]*\])?/)
    .map((line) => line.trim().replace(/^=\s*/, "").trim())
    .filter((line) => line !== "");
  if (lines.length === 0) throw new ExpressionError("递等式至少要有一行");
  return lines;
}

export function buildDengshiLayout(source: string): string {
  return dengshiTex(parseDengshiLines(source));
}
