/**
 * 短除法 → SVG。画法按常见写法【推论】：除数在左，竖线隔开，这一行的数下面一条横线；
 * 最后一行只写商；各列的数按个位（右端）对齐。
 */
import { COLORS, FONT_SIZE, fmt, rootStyle, type RenderOptions, type RenderedSvg } from "../render-svg.ts";
import type { ShortDivLayout, ShortDivRow, ShortDivTerm } from "./model.ts";
import { escapeXml } from "../xml.ts";

const CHAR_W = 14;
const COL_GAP = 20;
const ROW_H = 34;
const PAD = 6;
const LINE_GAP = 7;
const RESULT_H = 30;
const RESULT_FONT = 20;
const RESULT_CHAR_W = 11;

interface Geometry {
  readonly lineX: number;
  /** 第 j 列数的右端。 */
  readonly colRight: readonly number[];
  readonly gridRight: number;
}

function buildGeometry(layout: ShortDivLayout): Geometry {
  const divisorW = Math.max(0, ...layout.rows.map((r) => (r.divisor?.text.length ?? 0) * CHAR_W));
  const lineX = PAD + divisorW + LINE_GAP;
  const columns = Math.max(...layout.rows.map((r) => r.values.length));
  const colRight: number[] = [];
  let x = lineX + LINE_GAP + 4;
  for (let j = 0; j < columns; j += 1) {
    const width = Math.max(...layout.rows.map((r) => (r.values[j]?.text.length ?? 0) * CHAR_W));
    x += (j === 0 ? 0 : COL_GAP) + width;
    colRight.push(x);
  }
  return { lineX, colRight, gridRight: x };
}

function drawTerm(t: ShortDivTerm, right: number, top: number): string {
  const baseline = top + ROW_H * 0.76;
  const width = t.text.length * CHAR_W;
  const parts: string[] = [];
  if (t.marks.includes("err")) {
    parts.push(
      `<rect class="cmn-err" x="${fmt(right - width - 3)}" y="${fmt(top + 4)}" width="${fmt(width + 6)}" height="${ROW_H - 6}" rx="3" fill="${COLORS.errBg}"/>`,
    );
  }
  const fill = t.color ?? (t.marks.includes("hong") ? COLORS.teach : COLORS.ink);
  parts.push(`<text x="${fmt(right)}" y="${fmt(baseline)}" font-size="${FONT_SIZE}" text-anchor="end" fill="${fill}">${t.text}</text>`);
  return parts.join("");
}

function drawRow(geo: Geometry, row: ShortDivRow, top: number): string {
  const parts = row.values.map((v, j) => drawTerm(v, geo.colRight[j]!, top));
  if (row.divisor === undefined) return parts.join("");
  const bottom = top + ROW_H;
  parts.push(
    drawTerm(row.divisor, geo.lineX - LINE_GAP, top),
    `<line class="cmn-dc-v" x1="${fmt(geo.lineX)}" y1="${fmt(top + 4)}" x2="${fmt(geo.lineX)}" y2="${fmt(bottom)}" stroke="${COLORS.ink}" stroke-width="1.3"/>`,
    `<line class="cmn-dc-h" x1="${fmt(geo.lineX)}" y1="${fmt(bottom)}" x2="${fmt(geo.gridRight + 6)}" y2="${fmt(bottom)}" stroke="${COLORS.ink}" stroke-width="1.3"/>`,
  );
  return parts.join("");
}

export function describeShortDiv(layout: ShortDivLayout): string {
  const steps = layout.rows.map((r) => {
    const values = r.values.map((v) => v.text).join("、");
    return r.divisor === undefined ? `最后得 ${values}` : `${r.divisor.text} 除 ${values}`;
  });
  const result = layout.result.length === 0 ? "" : `；${layout.result.join("；")}`;
  return `短除法：${steps.join("，")}${result}`;
}

export function renderShortDiv(layout: ShortDivLayout, render: RenderOptions = {}): RenderedSvg {
  const geo = buildGeometry(layout);
  const body: string[] = [];
  let y = PAD + 2;
  for (const row of layout.rows) {
    body.push(drawRow(geo, row, y));
    y += ROW_H + (row.divisor === undefined ? 0 : 2);
  }
  for (const line of layout.result) {
    y += RESULT_H;
    body.push(`<text x="${PAD}" y="${fmt(y - 8)}" font-size="${RESULT_FONT}" fill="${COLORS.ink}">${line}</text>`);
  }
  const height = y + PAD;
  const resultW = Math.max(0, ...layout.result.map((l) => l.length * RESULT_CHAR_W + PAD * 2));
  const width = Math.max(geo.gridRight + PAD + 6, resultW);
  const label = describeShortDiv(layout);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="cmn-duanchu" role="img" aria-label="${escapeXml(label)}" style="${rootStyle(width, height, render.display ?? "inline-block")}" ` +
    `viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width / FONT_SIZE)}em" height="${fmt(height / FONT_SIZE)}em" ` +
    `font-family="'Helvetica Neue', Arial, 'PingFang SC', sans-serif">${body.join("")}</svg>`;
  return { svg, width, height, widthEm: width / FONT_SIZE, heightEm: height / FONT_SIZE, label };
}
