/**
 * 十字相乘 → SVG（设计草案 §10.3，维护者定画两条交叉斜线）：
 * 左列、右列各两项，左上连右下、左下连右上；有验算行时下面画横线再写验算；分解结果写在最下面。
 * 整张图用衬线体（与数学书一致），字母斜体，数字与符号正体。
 */
import { COLORS, FONT_SIZE, fmt, rootStyle, type RenderOptions, type RenderedSvg } from "../render-svg.ts";
import type { CrossMulLayout, CrossTerm } from "./model.ts";

const CHAR_W = 13;
const PAD = 8;
const ROW_H = 34;
/** 上下两行之间留给交叉线的高度。 */
const CROSS_H = 48;
/** 左右两列之间留给交叉线的宽度。 */
const CROSS_W = 64;
const RULE_GAP = 8;
const LINE_H = 32;
const SMALL_FONT = 20;
const SMALL_CHAR_W = 11;

/** 文字排成 tspan：字母斜体衬线，其余正体。 */
function mathText(text: string): string {
  return [...text.matchAll(/[a-zA-Z]+|[^a-zA-Z]+/g)]
    .map(([run]) =>
      /^[a-zA-Z]/.test(run) ? `<tspan font-style="italic">${run}</tspan>` : run,
    )
    .join("");
}

function width(text: string, charW: number): number {
  return [...text].length * charW;
}

function drawTerm(t: CrossTerm, x: number, baseline: number, anchor: "start" | "end" | "middle", size: number): string {
  const charW = size === FONT_SIZE ? CHAR_W : SMALL_CHAR_W;
  const w = width(t.text, charW);
  const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  const parts: string[] = [];
  if (t.marks.includes("err")) {
    parts.push(
      `<rect class="cmn-err" x="${fmt(left - 4)}" y="${fmt(baseline - size * 0.85)}" width="${fmt(w + 8)}" height="${fmt(size * 1.15)}" rx="3" fill="${COLORS.errBg}"/>`,
    );
  }
  const fill = t.marks.includes("hong") ? COLORS.teach : COLORS.ink;
  parts.push(
    `<text x="${fmt(x)}" y="${fmt(baseline)}" font-size="${size}" text-anchor="${anchor}" fill="${fill}">${mathText(t.text)}</text>`,
  );
  return parts.join("");
}

export function describeCrossMul(layout: CrossMulLayout): string {
  const rows = [0, 1].map((i) => `${layout.left[i]!.text} 与 ${layout.right[i]!.text}`).join("，");
  const tail = [layout.check?.text, ...layout.result].filter((s): s is string => s !== undefined);
  return `十字相乘：${rows}${tail.length === 0 ? "" : `；${tail.join("；")}`}`;
}

function crossLine(x1: number, y1: number, x2: number, y2: number): string {
  return `<line class="cmn-cross-line" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${COLORS.ink}" stroke-width="1.3"/>`;
}

export function renderCrossMul(layout: CrossMulLayout, render: RenderOptions = {}): RenderedSvg {
  const leftW = Math.max(...layout.left.map((t) => width(t.text, CHAR_W)));
  const rightW = Math.max(...layout.right.map((t) => width(t.text, CHAR_W)));
  const leftEdge = PAD + leftW; // 左列右对齐到这里
  const rightEdge = leftEdge + CROSS_W; // 右列左对齐从这里起
  const gridRight = rightEdge + rightW;
  const topBase = PAD + ROW_H * 0.75;
  const bottomBase = topBase + CROSS_H + ROW_H * 0.6;
  const midTop = topBase - ROW_H * 0.3;
  const midBottom = bottomBase - ROW_H * 0.3;
  const body = [
    drawTerm(layout.left[0], leftEdge, topBase, "end", FONT_SIZE),
    drawTerm(layout.right[0], rightEdge, topBase, "start", FONT_SIZE),
    drawTerm(layout.left[1], leftEdge, bottomBase, "end", FONT_SIZE),
    drawTerm(layout.right[1], rightEdge, bottomBase, "start", FONT_SIZE),
    crossLine(leftEdge + 8, midTop + 6, rightEdge - 8, midBottom - 6),
    crossLine(leftEdge + 8, midBottom - 6, rightEdge - 8, midTop + 6),
  ];
  let y = bottomBase + ROW_H * 0.3;
  let contentRight = gridRight;
  if (layout.check !== undefined) {
    y += RULE_GAP;
    const checkW = width(layout.check.text, CHAR_W);
    const ruleRight = Math.max(gridRight, PAD + checkW);
    body.push(
      `<line class="cmn-cross-rule" x1="${PAD}" y1="${fmt(y)}" x2="${fmt(ruleRight)}" y2="${fmt(y)}" stroke="${COLORS.ink}" stroke-width="1.3"/>`,
    );
    y += LINE_H;
    body.push(drawTerm(layout.check, (PAD + ruleRight) / 2, y - 8, "middle", FONT_SIZE));
    contentRight = ruleRight;
  }
  for (const line of layout.result) {
    y += LINE_H;
    body.push(drawTerm({ text: line, marks: [] }, PAD, y - 8, "start", SMALL_FONT));
    contentRight = Math.max(contentRight, PAD + width(line, SMALL_CHAR_W));
  }
  const height = y + PAD;
  const svgWidth = contentRight + PAD;
  const label = describeCrossMul(layout);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="cmn-shizi" role="img" aria-label="${label}" style="${rootStyle(svgWidth, height, render.display ?? "inline-block")}" ` +
    `viewBox="0 0 ${fmt(svgWidth)} ${fmt(height)}" width="${fmt(svgWidth / FONT_SIZE)}em" height="${fmt(height / FONT_SIZE)}em" ` +
    `font-family="'Times New Roman', 'Songti SC', serif">${body.join("")}</svg>`;
  return { svg, width: svgWidth, height, widthEm: svgWidth / FONT_SIZE, heightEm: height / FONT_SIZE, label };
}
