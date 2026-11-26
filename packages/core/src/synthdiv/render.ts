/**
 * 综合除法 → SVG（设计草案 §5.8）：根在左，竖线贯穿前两行，第二行下一条横线；
 * 结果行最后一格前画一条短竖线隔出余数。各列右对齐。
 */
import { COLORS, FONT_SIZE, fmt, rootStyle, type RenderOptions, type RenderedSvg } from "../render-svg.ts";
import { mathTextSvg } from "../math-text.ts";
import type { SynthDivLayout, SynthTerm } from "./model.ts";

const CHAR_W = 14;
const COL_GAP = 22;
const ROW_H = 34;
const PAD = 8;
const LINE_GAP = 8;
const RESULT_H = 30;
const RESULT_FONT = 20;
const RESULT_CHAR_W = 12;
/** 上方原题一行的高度。 */
const PROBLEM_H = 34;

function drawTerm(t: SynthTerm, right: number, top: number): string {
  const baseline = top + ROW_H * 0.76;
  const w = [...t.text].length * CHAR_W;
  const parts: string[] = [];
  if (t.marks.includes("err")) {
    parts.push(
      `<rect class="cmn-err" x="${fmt(right - w - 3)}" y="${fmt(top + 4)}" width="${fmt(w + 6)}" height="${ROW_H - 6}" rx="3" fill="${COLORS.errBg}"/>`,
    );
  }
  const fill = t.marks.includes("hong") ? COLORS.teach : COLORS.ink;
  parts.push(`<text x="${fmt(right)}" y="${fmt(baseline)}" font-size="${FONT_SIZE}" text-anchor="end" fill="${fill}">${t.text}</text>`);
  return parts.join("");
}

function line(cls: string, x1: number, y1: number, x2: number, y2: number): string {
  return `<line class="${cls}" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${COLORS.ink}" stroke-width="1.3"/>`;
}

export function describeSynthDiv(l: SynthDivLayout): string {
  const join = (cells: readonly (SynthTerm | undefined)[]) => cells.flatMap((c) => (c === undefined ? [] : [c.text])).join("、");
  const quotient = join(l.bottom.slice(0, -1));
  const remainder = l.bottom[l.bottom.length - 1]!.text;
  const result = l.result.length === 0 ? "" : `；${l.result.join("；")}`;
  const problem = l.problem === undefined ? "" : `${l.problem}；`;
  return `综合除法：${problem}${l.root.text}，系数 ${join(l.top)}；乘得 ${join(l.middle)}；得 ${quotient}，余数 ${remainder}${result}`;
}

export function renderSynthDiv(l: SynthDivLayout, render: RenderOptions = {}): RenderedSvg {
  const all = [...l.top, ...l.bottom, ...l.middle.filter((c): c is SynthTerm => c !== undefined)];
  const colW = Math.max(...all.map((t) => [...t.text].length * CHAR_W)) + COL_GAP;
  const lineX = PAD + [...l.root.text].length * CHAR_W + LINE_GAP;
  const colRight = (i: number): number => lineX + LINE_GAP + (i + 1) * colW - COL_GAP / 2;
  const gridRight = colRight(l.top.length - 1) + COL_GAP / 2;
  const top1 = PAD + (l.problem === undefined ? 0 : PROBLEM_H);
  const top2 = top1 + ROW_H;
  const ruleY = top2 + ROW_H + 2;
  const top3 = ruleY + 2;
  const remX = colRight(l.top.length - 2) + COL_GAP / 2 + 2;
  const body = [
    drawTerm(l.root, lineX - LINE_GAP, top1),
    ...l.top.map((t, i) => drawTerm(t, colRight(i), top1)),
    ...l.middle.flatMap((t, i) => (t === undefined ? [] : [drawTerm(t, colRight(i), top2)])),
    ...l.bottom.map((t, i) => drawTerm(t, colRight(i), top3)),
    line("cmn-zh-v", lineX, top1 + 4, lineX, ruleY),
    line("cmn-zh-h", lineX, ruleY, gridRight + 4, ruleY),
    line("cmn-zh-rem", remX, ruleY, remX, top3 + ROW_H - 2),
  ];
  if (l.problem !== undefined) {
    body.push(
      `<text class="cmn-problem" x="${PAD}" y="${fmt(PAD + PROBLEM_H * 0.7)}" font-size="${RESULT_FONT + 2}" fill="${COLORS.ink}">${mathTextSvg(l.problem)}</text>`,
    );
  }
  let y = top3 + ROW_H;
  for (const text of l.result) {
    y += RESULT_H;
    body.push(`<text x="${PAD}" y="${fmt(y - 8)}" font-size="${RESULT_FONT}" fill="${COLORS.ink}">${mathTextSvg(text)}</text>`);
  }
  const height = y + PAD;
  const lines = l.problem === undefined ? l.result : [l.problem, ...l.result];
  const resultW = Math.max(0, ...lines.map((t) => [...t].length * RESULT_CHAR_W + PAD * 2));
  const width = Math.max(gridRight + PAD + 4, resultW);
  const label = describeSynthDiv(l);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="cmn-zonghe" role="img" aria-label="${label}" style="${rootStyle(width, height, render.display ?? "inline-block")}" ` +
    `viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width / FONT_SIZE)}em" height="${fmt(height / FONT_SIZE)}em" ` +
    `font-family="'Helvetica Neue', Arial, 'PingFang SC', sans-serif">${body.join("")}</svg>`;
  return { svg, width, height, widthEm: width / FONT_SIZE, heightEm: height / FONT_SIZE, label };
}
