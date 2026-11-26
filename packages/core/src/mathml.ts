/**
 * 布局 → MathML（MathML 3 §3.6 小学算术：mstack / mlongdiv / mscarries / msline）。
 *
 * - 列对齐：每行从自己的最高位写到全竖式的最低列，缺的格子补空 <mrow/>，统一 stackalign="right"，
 *   不依赖渲染器对小数点对齐的实现；小数点占一列（与规范一致）。
 * - 进位、退位点：合并成该行前面的一个 <mscarries>，每格用 <mscarry location=…> 指定方位。
 *   进位写在下一行上方 → 挂在下一行，location n；退位点 → location n，内容“·”。
 *   进位坐在横线上（课本写法）→ 单独一行红色小号数字（见 sittingCarryRow）；carries=above 时改为挂在上一行、location n。
 * - 补 0 → menclose box；划掉 → menclose updiagonalstrike；错误 → mathbackground；着色、红色强调 → mathcolor。
 * - 数位虚线在 MathML 里没有对应写法，导出时省略。
 */
import type { CarryRow, Cell, DigitRow, Layout, Operator } from "./model.ts";
import { DEFAULT_STYLE, type StyleOptions } from "./options.ts";
import { COLORS, describe } from "./render-svg.ts";

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

export interface MathMLOptions {
  /** 外面包不包 <math>。嵌进 KaTeX 等已有 <math> 的场合用 false。默认 true。 */
  readonly wrap?: boolean;
  /** <math display=…>，默认 block。 */
  readonly display?: "block" | "inline";
  /**
   * 进位方位：textbook（默认，按课本写在下方：s / se，或写在下一行上方：n / ne）；
   * above（一律写成 MathML 默认的 n，挂在进到的那一行上方）——兼容性更好，但不是课本写法。
   */
  readonly carries?: "textbook" | "above";
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const EMPTY = "<mrow/>";
const OPERATOR_TEXT: Readonly<Record<Operator, string>> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };

/** 全竖式的列，从高位到低位（有小数点时含 -0.5 列）。 */
function allColumns(layout: Layout): number[] {
  const cols = new Set<number>();
  for (const row of layout.rows) {
    if (row.kind === "hline") continue;
    for (const c of row.cells) cols.add(c.col);
  }
  const ints = [...cols].filter((c) => Number.isInteger(c));
  const max = Math.max(0, ...ints);
  const min = Math.min(0, ...ints);
  const out: number[] = [];
  for (let c = max; c >= min; c -= 1) {
    out.push(c);
    if (c === 0 && layout.hasDecimal) out.push(-0.5);
  }
  return out;
}

function cellElement(cell: Cell): string {
  if (cell.content.kind === "blank") {
    return cell.marks.includes("err") ? `<mspace width="0.5em" mathbackground="${COLORS.errBg}"/>` : EMPTY;
  }
  const marks = new Set(cell.marks);
  const attrs: string[] = [];
  const color = cell.color ?? (marks.has("hong") ? COLORS.teach : undefined);
  if (color !== undefined) attrs.push(`mathcolor="${escapeXml(color)}"`);
  if (marks.has("err")) attrs.push(`mathbackground="${COLORS.errBg}"`);
  const text = cell.content.kind === "digit" ? cell.content.text : ".";
  let el = `<mn${attrs.length > 0 ? " " + attrs.join(" ") : ""}>${text}</mn>`;
  if (marks.has("bu")) el = `<menclose notation="box" mathcolor="${COLORS.teach}">${el}</menclose>`;
  if (marks.has("hua")) el = `<menclose notation="updiagonalstrike">${el}</menclose>`;
  return el;
}

/** 一行格子：从这一行的最高位写到全竖式最低列，缺的补空。 */
function rowCells(cells: readonly Cell[], cols: readonly number[]): string[] {
  const byCol = new Map(cells.map((c) => [c.col, c]));
  const top = Math.max(...cells.map((c) => c.col));
  return cols.filter((c) => c <= top).map((c) => {
    const cell = byCol.get(c);
    return cell === undefined ? EMPTY : cellElement(cell);
  });
}

interface Annotation {
  readonly content: string;
  readonly location: string;
}

function carryAnnotations(row: CarryRow, location: string): Map<number, Annotation> {
  const out = new Map<number, Annotation>();
  for (const c of row.cells) {
    if (c.content.kind !== "digit") continue;
    const color = c.color ?? COLORS.teach;
    out.set(c.col, { content: `<mn mathcolor="${escapeXml(color)}">${c.content.text}</mn>`, location });
  }
  return out;
}

function borrowAnnotations(row: DigitRow): Map<number, Annotation> {
  const out = new Map<number, Annotation>();
  for (const c of row.cells) {
    if (c.marks.includes("tui")) out.set(c.col, { content: `<mo mathcolor="${COLORS.teach}">·</mo>`, location: "n" });
  }
  return out;
}

function mscarries(ann: ReadonlyMap<number, Annotation>, cols: readonly number[]): string {
  if (ann.size === 0) return "";
  const top = Math.max(...ann.keys());
  const items = cols
    .filter((c) => c <= top)
    .map((c) => {
      const a = ann.get(c);
      return a === undefined ? EMPTY : `<mscarry location="${a.location}" crossout="none">${a.content}</mscarry>`;
    });
  return `<mscarries crossout="none" scriptsizemultiplier="0.6">${items.join("")}</mscarries>`;
}

/** 把进位行、退位点归到对应的数字行上，得到“数字行 → 前置进位”的表。 */
/** 课本写法下，坐在横线上的进位行不进 mscarries，而是单独成一行小号数字（见 sittingCarryRow）。 */
function sitsOnRule(layout: Layout, i: number): boolean {
  const next = layout.rows[i + 1];
  return next === undefined || next.kind === "hline";
}

function annotationsByRow(layout: Layout, style: StyleOptions, mode: "textbook" | "above"): Map<number, Map<number, Annotation>> {
  const textbook = mode === "textbook";
  // 一律用 n：W3C polyfill 只正确支持 n，s / se / ne 都会错位（2026-11-26 实测）；左下写法只是同列内的细微偏移，MathML 里不区分
  const above = "n";
  void style;
  const result = new Map<number, Map<number, Annotation>>();
  const add = (rowIndex: number, ann: Map<number, Annotation>) => {
    const cur = result.get(rowIndex) ?? new Map<number, Annotation>();
    for (const [col, a] of ann) if (!cur.has(col)) cur.set(col, a);
    result.set(rowIndex, cur);
  };
  layout.rows.forEach((row, i) => {
    if (row.kind === "digits") add(i, borrowAnnotations(row));
    if (row.kind !== "carry") return;
    const next = layout.rows[i + 1];
    if (sitsOnRule(layout, i)) {
      if (textbook) return; // 课本写法：单独成一行小号数字，不进 mscarries
      // 写上方：挂在进到的那一行（上一行数字行）
      for (let j = i - 1; j >= 0; j -= 1) {
        if (layout.rows[j]!.kind === "digits") {
          add(j, carryAnnotations(row, "n"));
          break;
        }
      }
    } else {
      for (let j = i + 1; j < layout.rows.length; j += 1) {
        if (layout.rows[j]!.kind === "digits") {
          add(j, carryAnnotations(row, above));
          break;
        }
      }
    }
  });
  return result;
}

/**
 * 课本写法里坐在横线上的进位：一行红色小号数字，夹在上一行与横线之间。
 * 不用 mscarries location="s"：W3C polyfill 对 s / se 方位的渲染有误（横线被打断、整行错位，2026-11-26 实测）。
 * 代价是 MathML 里不再标明“这是进位”，但所有渲染器都按普通行排，位置可靠。
 */
function sittingCarryRow(row: CarryRow, cols: readonly number[]): string {
  const byCol = new Map(row.cells.map((c) => [c.col, c]));
  const top = Math.max(...row.cells.map((c) => c.col));
  const cells = cols
    .filter((c) => c <= top)
    .map((c) => {
      const cell = byCol.get(c);
      if (cell === undefined || cell.content.kind !== "digit") return EMPTY;
      const color = cell.color ?? COLORS.teach;
      return `<mn mathsize="small" mathcolor="${escapeXml(color)}">${cell.content.text}</mn>`;
    });
  return `<msrow>${cells.join("")}</msrow>`;
}

function digitRowElement(row: DigitRow, cols: readonly number[]): string {
  const cells = rowCells(row.cells, cols);
  const op = row.operator === undefined ? "" : `<mo>${OPERATOR_TEXT[row.operator]}</mo>`;
  return `<msrow>${op}${cells.join("")}</msrow>`;
}

function stackBody(layout: Layout, style: StyleOptions, skip: ReadonlySet<number>, mode: "textbook" | "above"): string[] {
  const cols = allColumns(layout);
  const ann = annotationsByRow(layout, style, mode);
  const parts: string[] = [];
  layout.rows.forEach((row, i) => {
    if (skip.has(i)) return;
    if (row.kind === "carry") {
      if (mode === "textbook" && sitsOnRule(layout, i)) parts.push(sittingCarryRow(row, cols));
      return; // 其余进位已并入相邻数字行的 mscarries
    }
    if (row.kind === "hline") {
      parts.push("<msline/>");
      return;
    }
    const carries = ann.get(i);
    if (carries !== undefined) parts.push(mscarries(carries, cols));
    parts.push(digitRowElement(row, cols));
  });
  return parts.filter((p) => p !== "");
}

/** 竖式布局 → MathML 字符串。 */
export function layoutToMathML(layout: Layout, style: StyleOptions = DEFAULT_STYLE, opts: MathMLOptions = {}): string {
  const quotientIndex = layout.rows.findIndex((r) => r.kind === "digits" && r.quotient === true);
  const dividendIndex = layout.rows.findIndex((r) => r.kind === "digits" && r.divisor !== undefined);
  let body: string;
  if (dividendIndex >= 0) {
    const dividend = layout.rows[dividendIndex] as DigitRow;
    const cols = allColumns(layout);
    const result =
      quotientIndex >= 0 ? `<msrow>${rowCells((layout.rows[quotientIndex] as DigitRow).cells, cols).join("")}</msrow>` : EMPTY;
    const rest = stackBody(layout, style, new Set([quotientIndex, dividendIndex]), opts.carries ?? "textbook");
    body =
      `<mlongdiv longdivstyle="lefttop" stackalign="right">` +
      `<mn>${escapeXml(dividend.divisor!)}</mn>${result}` +
      `<msrow>${rowCells(dividend.cells, cols).join("")}</msrow>${rest.join("")}</mlongdiv>`;
  } else {
    body = `<mstack stackalign="right">${stackBody(layout, style, new Set(), opts.carries ?? "textbook").join("")}</mstack>`;
  }
  if (opts.wrap === false) return body;
  const display = opts.display ?? "block";
  return `<math xmlns="${MATHML_NS}" display="${display}" alttext="${escapeXml(describe(layout))}">${body}</math>`;
}
