/**
 * 布局 → MathML（MathML 3 §3.6 小学算术：mstack / mlongdiv / mscarries / msline）。
 *
 * - 列对齐：每行从自己的最高位写到全竖式的最低列，缺的格子补空 <mrow/>，统一 stackalign="right"，
 *   不依赖渲染器对小数点对齐的实现；pointColumn 时小数点占一列（与规范一致），默认与前一位同格（见下）。
 * - 进位、退位点：合并成该行前面的一个 <mscarries>，每格用 <mscarry location=…> 指定方位。
 *   进位坐在横线上（课本写法）→ 挂在上一行，location s，并用看不见的占位进位铺满整行（见 mscarries 的 fillTop）；
 *   carries=above 时改为 location n（画在上一行上方）。进位写在下一行上方 → 挂在下一行，location n；
 *   退位点 → location n，内容“·”。左下写法（carryAt=sw）在 MathML 里不区分。
 * - 补 0 → menclose box；划掉 → menclose updiagonalstrike；错误 → mathbackground；着色、红色强调 → mathcolor。
 * - 空隙小数点（默认）：与前一位合成一格 <mrow><mn>4</mn><mn>.</mn></mrow>，不另占一列；
 *   划掉的小数点 → menclose updiagonalstrike。
 * - 数位虚线在 MathML 里没有对应写法，导出时省略。
 */
import type { CarryRow, Cell, DigitRow, Layout, Operator, PointMark } from "./model.ts";
import { DEFAULT_STYLE, type StyleOptions } from "./options.ts";
import { hasLetters, termToMathML } from "./math-text.ts";
import { toGapPoints } from "./point-style.ts";
import { COLORS, describe } from "./render-svg.ts";
import { escapeXml } from "./xml.ts";

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


const EMPTY = "<mrow/>";
const OPERATOR_TEXT: Readonly<Record<Operator, string>> = { "+": "+", "-": "−", "×": "×", "÷": "÷", "≈": "≈" };

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

function pointElement(point: PointMark): string {
  if (point === "hong") return `<mn mathcolor="${COLORS.teach}">.</mn>`;
  if (point === "hua") return `<menclose notation="updiagonalstrike"><mn>.</mn></menclose>`;
  return "<mn>.</mn>";
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
  let el: string;
  if (cell.content.kind === "ellipsis") {
    el = "<mo>…</mo>";
  } else if (cell.content.kind === "term") {
    const term = termToMathML(cell.content.text);
    el = attrs.length > 0 ? `<mrow ${attrs.join(" ")}>${term}</mrow>` : term;
  } else {
    const text = cell.content.kind === "digit" ? cell.content.text : ".";
    el = `<mn${attrs.length > 0 ? " " + attrs.join(" ") : ""}>${text}</mn>`;
  }
  if (marks.has("bu")) el = `<menclose notation="box" mathcolor="${COLORS.teach}">${el}</menclose>`;
  if (marks.has("hua")) el = `<menclose notation="updiagonalstrike">${el}</menclose>`;
  if (marks.has("xun")) el = `<mover accent="true">${el}<mo mathcolor="${COLORS.teach}">˙</mo></mover>`;
  return cell.point === undefined ? el : `<mrow>${el}${pointElement(cell.point)}</mrow>`;
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

/** 占位进位：看不见，但和真进位一样高（见 fillTop）。 */
/**
 * 不用 <mphantom>：polyfill 里它比真进位矮约 1px，横线仍有台阶；与真进位同结构、透明着色则差距 < 0.5px（2026-11-26 实测）。
 * aria-hidden 让辅助技术跳过这个占位。
 */
const PHANTOM_CARRY = `<mscarry location="s" crossout="none"><mn mathcolor="transparent" aria-hidden="true">0</mn></mscarry>`;

/**
 * 一行前面的 mscarries。
 * fillTop：课本写法下坐在横线上的进位（location="s"）要铺满这一行（含运算符那一列），
 * 没有进位的格子放看不见的占位进位——W3C polyfill 把带进位的格子撑高，横线由各格下边框拼成，
 * 格子高低不一横线就断成几截（2026-11-26 实测）；每格都带进位则一样高，横线是一条直线。
 */
function mscarries(ann: ReadonlyMap<number, Annotation>, cols: readonly number[], fillTop?: number): string {
  if (ann.size === 0) return "";
  const top = Math.max(...ann.keys(), fillTop ?? -Infinity);
  // 运算符单独占的列不在数字列表里：铺满时在左边补上
  const extra: number[] = [];
  for (let c = top; c > Math.max(...cols); c -= 1) extra.push(c);
  const items = [...extra, ...cols.filter((c) => c <= top)]
    .map((c) => {
      const a = ann.get(c);
      if (a !== undefined) return `<mscarry location="${a.location}" crossout="none">${a.content}</mscarry>`;
      return fillTop === undefined ? EMPTY : PHANTOM_CARRY;
    });
  return `<mscarries crossout="none" scriptsizemultiplier="0.6">${items.join("")}</mscarries>`;
}

function sitsOnRule(layout: Layout, i: number): boolean {
  const next = layout.rows[i + 1];
  return next === undefined || next.kind === "hline";
}

/** 整个竖式最左一列（含运算符单独占的列）：polyfill 按全表宽度画横线，占位进位要铺满到这里。 */
function tableTop(layout: Layout): number {
  let top = 0;
  for (const row of layout.rows) {
    if (row.kind !== "digits" || row.cells.length === 0) continue;
    top = Math.max(top, Math.max(...row.cells.map((c) => c.col)) + (row.operator === undefined ? 0 : 1));
  }
  return top;
}

interface RowCarries {
  readonly ann: Map<number, Annotation>;
  /** 这一行挂了坐在横线上的进位：mscarries 要铺满到这一列（含运算符列）。 */
  fillTop?: number;
}

/** 把进位行、退位点归到对应的数字行上，得到“数字行 → 前置 mscarries”的表。 */
function annotationsByRow(layout: Layout, mode: "textbook" | "above"): Map<number, RowCarries> {
  // 左下写法（carryAt=sw）只是同列内的细微偏移，MathML 里不区分；polyfill 对 se / ne / sw 的渲染也有误
  const sitting = mode === "textbook" ? "s" : "n";
  const result = new Map<number, RowCarries>();
  const entry = (rowIndex: number): RowCarries => {
    const cur = result.get(rowIndex) ?? { ann: new Map<number, Annotation>() };
    result.set(rowIndex, cur);
    return cur;
  };
  const add = (rowIndex: number, ann: Map<number, Annotation>) => {
    const cur = entry(rowIndex).ann;
    for (const [col, a] of ann) if (!cur.has(col)) cur.set(col, a);
  };
  const digitRowNear = (from: number, step: 1 | -1): number => {
    for (let j = from; j >= 0 && j < layout.rows.length; j += step) if (layout.rows[j]!.kind === "digits") return j;
    return -1;
  };
  layout.rows.forEach((row, i) => {
    if (row.kind === "digits") add(i, borrowAnnotations(row));
    if (row.kind !== "carry") return;
    if (sitsOnRule(layout, i)) {
      // 坐在横线上：挂在上一行数字行（课本写法 location=s 画在它下方；above 时 location=n 画在它上方）
      const j = digitRowNear(i - 1, -1);
      if (j < 0) return;
      add(j, carryAnnotations(row, sitting));
      if (mode === "textbook") entry(j).fillTop = tableTop(layout);
    } else {
      // 写在下一行上方：挂在下一行数字行，location=n
      const j = digitRowNear(i + 1, 1);
      if (j >= 0) add(j, carryAnnotations(row, "n"));
    }
  });
  return result;
}

function digitRowElement(row: DigitRow, cols: readonly number[]): string {
  const cells = rowCells(row.cells, cols);
  const op = row.operator === undefined ? "" : `<mo>${OPERATOR_TEXT[row.operator]}</mo>`;
  return `<msrow>${op}${cells.join("")}</msrow>`;
}

function stackBody(layout: Layout, skip: ReadonlySet<number>, mode: "textbook" | "above"): string[] {
  const cols = allColumns(layout);
  const ann = annotationsByRow(layout, mode);
  const parts: string[] = [];
  layout.rows.forEach((row, i) => {
    if (skip.has(i)) return;
    if (row.kind === "carry") return; // 已并入相邻数字行的 mscarries
    if (row.kind === "hline") {
      parts.push("<msline/>");
      return;
    }
    const carries = ann.get(i);
    if (carries !== undefined) parts.push(mscarries(carries.ann, cols, carries.fillTop));
    parts.push(digitRowElement(row, cols));
  });
  return parts.filter((p) => p !== "");
}

/** 除数；有划掉的小数点时拆开写。 */
function divisorElement(row: DigitRow): string {
  const divisor = row.divisor ?? "";
  const k = row.divisorStruckPoint;
  if (k === undefined) return hasLetters(divisor) ? termToMathML(divisor) : `<mn>${escapeXml(divisor)}</mn>`;
  const part = (s: string): string => (s === "" ? "" : `<mn>${escapeXml(s)}</mn>`);
  return `<mrow>${part(divisor.slice(0, k))}${pointElement("hua")}${part(divisor.slice(k))}</mrow>`;
}

/**
 * 竖式布局 → MathML 字符串。style 只影响小数点写法（pointColumn）；左下进位写法在 MathML 里不区分。
 */
export function layoutToMathML(source: Layout, style: StyleOptions = DEFAULT_STYLE, opts: MathMLOptions = {}): string {
  const layout = style.pointColumn ? source : toGapPoints(source);
  const quotientIndex = layout.rows.findIndex((r) => r.kind === "digits" && r.quotient === true);
  const dividendIndex = layout.rows.findIndex((r) => r.kind === "digits" && r.divisor !== undefined);
  let body: string;
  if (dividendIndex >= 0) {
    const dividend = layout.rows[dividendIndex] as DigitRow;
    const cols = allColumns(layout);
    const result =
      quotientIndex >= 0 ? `<msrow>${rowCells((layout.rows[quotientIndex] as DigitRow).cells, cols).join("")}</msrow>` : EMPTY;
    const rest = stackBody(layout, new Set([quotientIndex, dividendIndex]), opts.carries ?? "textbook");
    body =
      `<mlongdiv longdivstyle="lefttop" stackalign="right">` +
      `${divisorElement(dividend)}${result}` +
      `<msrow>${rowCells(dividend.cells, cols).join("")}</msrow>${rest.join("")}</mlongdiv>`;
  } else {
    body = `<mstack stackalign="right">${stackBody(layout, new Set(), opts.carries ?? "textbook").join("")}</mstack>`;
  }
  if (opts.wrap === false) return body;
  const display = opts.display ?? "block";
  return `<math xmlns="${MATHML_NS}" display="${display}" alttext="${escapeXml(describe(layout))}">${body}</math>`;
}
