/**
 * 布局 → SVG 字符串。几何单位是 px，1em = FONT_SIZE px；对外同时给出 em 尺寸，便于嵌入 KaTeX。
 * 画法依据沪教版样本（设计草案 §11）。
 */
import type { CarryRow, Cell, DigitRow, Layout, Operator, PointMark, Row } from "./model.ts";
import { DEFAULT_STYLE, type StyleOptions } from "./options.ts";
import { hasLetters, mathTextSvg } from "./math-text.ts";
import { toGapPoints } from "./point-style.ts";
import { escapeXml } from "./xml.ts";

export const FONT_SIZE = 24;
const CELL_W = 28;
const POINT_W = 10;
const ROW_H = 34;
const CARRY_H = 13;
const CARRY_FONT = 13;
const RULE_H = 6;
const OP_W = 26;
const PAD = 6;
const BRACKET_W = 12;
const DIVISOR_CHAR_W = 14;
/** 除数里划掉的小数点额外占的宽度。 */
const DIVISOR_POINT_W = 10;
/** 多项式的项：每个字符的估计宽度（上标次数算半个），两边留白。 */
const TERM_CHAR_W = 12;
const TERM_PAD = 14;
const SERIF = "'Times New Roman', 'Songti SC', serif";

/** 数字基线在一行里的位置（从行顶往下的比例）。 */
const BASELINE_RATIO = 0.76;

export const COLORS = {
  ink: "currentColor",
  teach: "#d4402b",
  guide: "#8fa9c2",
  errBg: "#ffd866",
} as const;

export interface RenderedSvg {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  readonly widthEm: number;
  readonly heightEm: number;
  /** 朗读用的文字描述。 */
  readonly label: string;
  /** 除法竖式：商那一行的基线离顶边多少 em（混写时这一行对齐前后文字的基线，维护者 2026-11-28）。 */
  readonly baselineEm?: number;
}

interface Geometry {
  readonly colLeft: ReadonlyMap<number, number>;
  readonly colWidth: (col: number) => number;
  readonly gridLeft: number;
  readonly gridRight: number;
}

function columnsOf(layout: Layout): number[] {
  const cols = new Set<number>();
  for (const row of layout.rows) {
    if (row.kind === "hline") continue;
    for (const c of row.cells) cols.add(c.col);
  }
  return [...cols];
}

function maxDivisorWidth(layout: Layout): number {
  let w = 0;
  for (const row of layout.rows) {
    if (row.kind === "digits" && row.divisor !== undefined) w = Math.max(w, divisorTextWidth(row) + 8);
  }
  return w;
}

function termWidth(text: string): number {
  return [...text].reduce((w, ch) => w + (/[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(ch) ? TERM_CHAR_W / 2 : TERM_CHAR_W), 0);
}

/** 有多项式的项时，各列按这一列最宽的项加宽。 */
function termColumnWidths(layout: Layout): Map<number, number> {
  const widths = new Map<number, number>();
  for (const row of layout.rows) {
    if (row.kind === "hline") continue;
    for (const c of row.cells) {
      if (c.content.kind !== "term") continue;
      widths.set(c.col, Math.max(widths.get(c.col) ?? CELL_W, termWidth(c.content.text) + TERM_PAD));
    }
  }
  return widths;
}

function hasTerms(layout: Layout): boolean {
  return layout.rows.some((r) => r.kind !== "hline" && r.cells.some((c) => c.content.kind === "term"));
}

function buildGeometry(layout: Layout, style: StyleOptions): Geometry {
  const cols = columnsOf(layout);
  const termWidths = termColumnWidths(layout);
  const intCols = cols.filter((c) => Number.isInteger(c));
  let maxCol = Math.max(...intCols, 0);
  const minCol = Math.min(...cols, 0);
  if (style.operatorPlacement === "adjacent") {
    for (const row of layout.rows) {
      if (row.kind === "digits" && row.operator !== undefined) maxCol = Math.max(maxCol, leftmostCol(row) + 1);
    }
  }
  const hasOperatorFar =
    style.operatorPlacement === "far" && layout.rows.some((r) => r.kind === "digits" && r.operator !== undefined);
  const divisorW = maxDivisorWidth(layout);
  const gridLeft = PAD + (hasOperatorFar ? OP_W + 6 : 0) + (divisorW > 0 ? divisorW + BRACKET_W : 0);
  const colWidth = (col: number): number => (Number.isInteger(col) ? (termWidths.get(col) ?? CELL_W) : POINT_W);
  const colLeft = new Map<number, number>();
  let x = gridLeft;
  for (let c = maxCol; c >= minCol; c -= 1) {
    colLeft.set(c, x);
    x += colWidth(c);
    if (c === 0 && layout.hasDecimal) {
      colLeft.set(-0.5, x);
      x += POINT_W;
    }
  }
  return { colLeft, colWidth, gridLeft, gridRight: x };
}

function divisorTextWidth(row: DigitRow): number {
  const extra = row.divisorStruckPoint === undefined ? 0 : DIVISOR_POINT_W;
  return (row.divisor?.length ?? 0) * DIVISOR_CHAR_W + extra;
}

function leftmostCol(row: DigitRow | CarryRow): number {
  return Math.max(...row.cells.map((c) => c.col));
}

function cx(geo: Geometry, col: number): number {
  return (geo.colLeft.get(col) ?? geo.gridLeft) + geo.colWidth(col) / 2;
}

function text(x: number, y: number, body: string, size: number, fill: string, extra = ""): string {
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" text-anchor="middle" fill="${fill}"${extra}>${body}</text>`;
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * 空隙小数点（小数乘除法）：画在 (x, baseline) 处；hua 再加一道红色短斜线（课本的“、”）。
 */
function drawGapPoint(x: number, baseline: number, point: PointMark, color?: string): string {
  const fill = color ?? (point === "hong" ? COLORS.teach : COLORS.ink);
  const dot = `<circle class="cmn-dian" cx="${fmt(x)}" cy="${fmt(baseline - 1.5)}" r="1.8" fill="${fill}"/>`;
  if (point !== "hua") return dot;
  return (
    dot +
    `<line class="cmn-dian-hua" x1="${fmt(x - 3)}" y1="${fmt(baseline - 8)}" x2="${fmt(x + 3)}" y2="${fmt(baseline + 1)}" stroke="${COLORS.teach}" stroke-width="1.6" stroke-linecap="round"/>`
  );
}

function drawDigitCell(geo: Geometry, cell: Cell, top: number): string {
  const x = cx(geo, cell.col);
  const baseline = top + ROW_H * BASELINE_RATIO;
  const parts: string[] = [];
  const marks = new Set(cell.marks);
  if (marks.has("err")) {
    const half = cell.content.kind === "term" ? geo.colWidth(cell.col) / 2 - 3 : 9;
    parts.push(
      `<rect class="cmn-err" x="${fmt(x - half)}" y="${fmt(top + 4)}" width="${fmt(half * 2)}" height="${ROW_H - 6}" rx="3" fill="${COLORS.errBg}"/>`,
    );
  }
  if (cell.content.kind === "term") {
    const fill = cell.color ?? (marks.has("hong") ? COLORS.teach : COLORS.ink);
    parts.push(text(x, baseline, mathTextSvg(cell.content.text), FONT_SIZE, fill, ` font-family="${SERIF}"`));
  } else if (cell.content.kind === "digit") {
    const fill = cell.color ?? (marks.has("hong") ? COLORS.teach : COLORS.ink);
    parts.push(text(x, baseline, cell.content.text, FONT_SIZE, fill));
  } else if (cell.content.kind === "point") {
    parts.push(`<circle cx="${fmt(x)}" cy="${fmt(baseline - 1.5)}" r="1.8" fill="${cell.color ?? COLORS.ink}"/>`);
  } else if (cell.content.kind === "ellipsis") {
    parts.push(text(x, baseline, "…", FONT_SIZE, cell.color ?? COLORS.ink));
  }
  if (marks.has("xun")) {
    // 循环点：红色（维护者 2026-11-28）
    parts.push(`<circle class="cmn-xun" cx="${fmt(x)}" cy="${fmt(top + 3)}" r="2" fill="${cell.color ?? COLORS.teach}"/>`);
  }
  if (cell.point !== undefined) parts.push(drawGapPoint(x + geo.colWidth(cell.col) / 2, baseline, cell.point, cell.pointColor));
  if (marks.has("tui")) parts.push(`<circle class="cmn-tui" cx="${fmt(x)}" cy="${fmt(top + 1)}" r="2.6" fill="${COLORS.teach}"/>`);
  if (marks.has("bu")) {
    parts.push(
      `<rect class="cmn-bu" x="${fmt(x - 9)}" y="${fmt(top + 5)}" width="18" height="${ROW_H - 8}" fill="none" stroke="${COLORS.teach}" stroke-dasharray="3 2"/>`,
    );
  }
  if (marks.has("hua")) {
    parts.push(
      `<line x1="${fmt(x - 8)}" y1="${fmt(baseline)}" x2="${fmt(x + 8)}" y2="${fmt(top + 8)}" stroke="${COLORS.ink}" stroke-width="1.4"/>`,
    );
  }
  return parts.join("");
}

const OPERATOR_GLYPH: Readonly<Record<Operator, string>> = { "+": "+", "-": "−", "×": "×", "÷": "÷", "≈": "≈" };

function drawOperator(geo: Geometry, row: DigitRow, top: number, style: StyleOptions): string {
  if (row.operator === undefined) return "";
  const x = style.operatorPlacement === "adjacent" ? cx(geo, leftmostCol(row) + 1) : PAD + OP_W / 2;
  return text(x, top + ROW_H * BASELINE_RATIO, OPERATOR_GLYPH[row.operator], FONT_SIZE, COLORS.ink);
}

function drawCarryRow(geo: Geometry, row: CarryRow, top: number, sitsOnRule: boolean, style: StyleOptions): string {
  const baseline = sitsOnRule ? top + CARRY_H - 1 : top + CARRY_H + 2;
  return row.cells
    .filter((c) => c.content.kind === "digit")
    .map((c) => {
      const left = geo.colLeft.get(c.col) ?? geo.gridLeft;
      const x = style.carryAt === "sw" ? left + geo.colWidth(c.col) - 3 : left + geo.colWidth(c.col) / 2;
      const body = c.content.kind === "digit" ? c.content.text : "";
      return text(x, baseline, body, CARRY_FONT, c.color ?? COLORS.teach, ' class="cmn-jin"');
    })
    .join("");
}

function drawDivisor(geo: Geometry, row: DigitRow, top: number): string {
  if (row.divisor === undefined) return "";
  const bracketX = (geo.colLeft.get(leftmostCol(row)) ?? geo.gridLeft) - 4;
  const divisorX = bracketX - BRACKET_W / 2 - divisorTextWidth(row) / 2;
  const lineY = top + 3;
  return [
    drawDivisorText(row, divisorX, top + ROW_H * BASELINE_RATIO),
    `<path class="cmn-bracket" style="stroke:${COLORS.ink};fill:none" d="M ${fmt(bracketX)} ${fmt(lineY)} Q ${fmt(bracketX + 7)} ${fmt(top + ROW_H / 2)} ${fmt(bracketX - 2)} ${fmt(top + ROW_H - 2)}" fill="none" stroke="${COLORS.ink}" stroke-width="1.3"/>`,
    `<line x1="${fmt(bracketX)}" y1="${fmt(lineY)}" x2="${fmt(geo.gridRight + 4)}" y2="${fmt(lineY)}" stroke="${COLORS.ink}" stroke-width="1.3"/>`,
  ].join("");
}

/** 除数：有划掉的小数点时逐个字符排，把小数点画在空隙里。 */
function drawDivisorText(row: DigitRow, centerX: number, baseline: number): string {
  const divisor = row.divisor ?? "";
  const k = row.divisorStruckPoint;
  if (k === undefined && hasLetters(divisor)) {
    return text(centerX, baseline, mathTextSvg(divisor), FONT_SIZE, COLORS.ink, ` font-family="${SERIF}"`);
  }
  if (k === undefined) return text(centerX, baseline, divisor, FONT_SIZE, COLORS.ink);
  const left = centerX - divisorTextWidth(row) / 2;
  const chars = [...divisor].map((ch, i) => {
    const x = left + i * DIVISOR_CHAR_W + DIVISOR_CHAR_W / 2 + (i >= k ? DIVISOR_POINT_W : 0);
    return text(x, baseline, ch, FONT_SIZE, COLORS.ink);
  });
  const pointX = left + k * DIVISOR_CHAR_W + DIVISOR_POINT_W / 2;
  return chars.join("") + drawGapPoint(pointX, baseline, "hua");
}

function rowHeight(row: Row): number {
  if (row.kind === "digits") return ROW_H;
  if (row.kind === "carry") return CARRY_H;
  return RULE_H;
}

function ruleLeft(layout: Layout, geo: Geometry): number {
  const division = layout.rows.some((r) => r.kind === "digits" && r.divisor !== undefined);
  if (division) {
    const dividend = layout.rows.find((r): r is DigitRow => r.kind === "digits" && r.divisor !== undefined)!;
    return (geo.colLeft.get(leftmostCol(dividend)) ?? geo.gridLeft) - 4;
  }
  return PAD;
}

/** 数位虚线：每一列（含小数点那条窄列）的左边界，加最右一列的右边界。 */
function drawGuides(geo: Geometry, top: number, bottom: number): string {
  const edges = [...geo.colLeft.values(), geo.gridRight];
  return [...new Set(edges)]
    .map(
      (x) =>
        `<line class="cmn-guide" x1="${fmt(x)}" y1="${fmt(top)}" x2="${fmt(x)}" y2="${fmt(bottom)}" stroke="${COLORS.guide}" stroke-width="1" stroke-dasharray="4 3"/>`,
    )
    .join("");
}

/** 打了循环点的商：朗读时说出循环节（循环点在首尾两位上）。 */
function cycleNote(cells: readonly Cell[]): string {
  const sorted = [...cells].sort((a, b) => b.col - a.col);
  const dotted = sorted.map((c, i) => (c.marks.includes("xun") ? i : -1)).filter((i) => i >= 0);
  if (dotted.length === 0) return "";
  const cycle = sorted.slice(dotted[0], dotted.at(-1)! + 1).map((c) => (c.content.kind === "digit" ? c.content.text : ""));
  return `（循环节 ${cycle.join("")}）`;
}

export function describe(layout: Layout): string {
  const words: Record<Operator, string> = { "+": "加", "-": "减", "×": "乘", "÷": "除以", "≈": "约等于" };
  const lines = layout.rows.flatMap((row) => {
    if (row.kind !== "digits") return [];
    const digits = row.cells
      .map((c) => {
        const body =
          c.content.kind === "digit" || c.content.kind === "term"
            ? c.content.text
            : c.content.kind === "point"
              ? "点"
              : c.content.kind === "ellipsis"
                ? "……"
                : "";
        return c.point === "dot" || c.point === "hong" ? `${body}点` : body;
      })
      .join("");
    if (row.divisor !== undefined) return [`${digits} 除以 ${row.divisor}`];
    if (row.quotient) return [`商 ${digits}${cycleNote(row.cells)}`];
    return [row.operator === undefined ? digits : `${words[row.operator]} ${digits}`];
  });
  return `竖式：${lines.join("，")}`;
}

/**
 * 根元素内联样式：嵌进 KaTeX 时，katex.css 的 `.katex svg{position:absolute;height:inherit;stroke:currentColor…}`
 * 与 `.katex svg path{stroke:none}` 会压扁竖式、抹掉括号（试写页实测）。内联样式优先级更高，可盖过它们。
 */
export function rootStyle(width: number, height: number, display: RootDisplay): string {
  return [
    `display:${display}`,
    "position:static",
    `width:${fmt(width / FONT_SIZE)}em`,
    `height:${fmt(height / FONT_SIZE)}em`,
    "overflow:visible",
    "fill:currentColor",
    "stroke:none",
    "vertical-align:top",
  ].join(";");
}

/** inline-block：单独使用（默认）；block：嵌进外层盒子（如 KaTeX 插件），避免基线错位撑出空白。 */
export type RootDisplay = "inline-block" | "block";

export interface RenderOptions {
  readonly display?: RootDisplay;
}

export function renderLayout(
  source: Layout,
  style: StyleOptions = DEFAULT_STYLE,
  render: RenderOptions = {},
): RenderedSvg {
  const layout = style.pointColumn ? source : toGapPoints(source);
  const geo = buildGeometry(layout, style);
  const body: string[] = [];
  const left = ruleLeft(layout, geo);
  let y = PAD + 2;
  const contentTop = y;
  let quotientBaseline: number | undefined;
  layout.rows.forEach((row, i) => {
    const h = rowHeight(row);
    if (row.kind === "digits" && row.quotient === true) quotientBaseline = y + ROW_H * BASELINE_RATIO;
    if (row.kind === "digits") {
      body.push(drawOperator(geo, row, y, style), drawDivisor(geo, row, y));
      for (const c of row.cells) body.push(drawDigitCell(geo, c, y));
    } else if (row.kind === "carry") {
      body.push(drawCarryRow(geo, row, y, layout.rows[i + 1]?.kind === "hline", style));
    } else {
      const lineY = y + RULE_H / 2;
      body.push(
        `<line x1="${fmt(left)}" y1="${fmt(lineY)}" x2="${fmt(geo.gridRight + 4)}" y2="${fmt(lineY)}" stroke="${COLORS.ink}" stroke-width="1.3"/>`,
      );
    }
    y += h;
  });
  const height = y + PAD;
  const width = geo.gridRight + PAD + 4;
  // 多项式竖式按次数对齐，数位虚线没有意义，不画
  const guides = style.guides && !hasTerms(layout) ? drawGuides(geo, contentTop, y) : "";
  const label = describe(layout);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="cmn-shushi" role="img" aria-label="${escapeXml(label)}" style="${rootStyle(width, height, render.display ?? "inline-block")}" ` +
    `viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width / FONT_SIZE)}em" height="${fmt(height / FONT_SIZE)}em" ` +
    `font-family="'Helvetica Neue', Arial, 'PingFang SC', sans-serif">` +
    guides +
    body.join("") +
    `</svg>`;
  const base = { svg, width, height, widthEm: width / FONT_SIZE, heightEm: height / FONT_SIZE, label };
  return quotientBaseline === undefined ? base : { ...base, baselineEm: quotientBaseline / FONT_SIZE };
}
