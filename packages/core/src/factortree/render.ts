/**
 * 树状图 → SVG。分层布局（设计草案 §10.2，自己画、不引入图布局库）：
 * 叶子从左到右依次排开，拆开的数居中在它最左、最右两个孩子的上方；父子之间连一条斜线；质数叶子画圈。
 */
import { COLORS, FONT_SIZE, fmt, rootStyle, type RenderOptions, type RenderedSvg } from "../render-svg.ts";
import type { FactorTree, FactorTreeNode } from "./model.ts";
import { escapeXml } from "../xml.ts";

const CHAR_W = 14;
const LEAF_GAP = 22;
const LEVEL_H = 58;
const NODE_H = 30;
const PAD = 8;
const MIN_RADIUS = 15;
const RESULT_H = 30;
const RESULT_FONT = 20;
const RESULT_CHAR_W = 11;

interface Placed {
  readonly node: FactorTreeNode;
  readonly x: number;
  readonly depth: number;
  readonly children: readonly Placed[];
}

function radius(node: FactorTreeNode): number {
  return Math.max(MIN_RADIUS, (node.value.length * CHAR_W) / 2 + 6);
}

function slotWidth(node: FactorTreeNode): number {
  return Math.max(node.value.length * CHAR_W, 2 * radius(node)) + LEAF_GAP;
}

/** 依次给叶子排位置；返回放好的子树和下一个叶子的起点。 */
function place(node: FactorTreeNode, depth: number, cursor: number): { placed: Placed; cursor: number } {
  if (node.children.length === 0) {
    const w = slotWidth(node);
    return { placed: { node, x: cursor + w / 2, depth, children: [] }, cursor: cursor + w };
  }
  const children: Placed[] = [];
  let next = cursor;
  for (const child of node.children) {
    const r = place(child, depth + 1, next);
    children.push(r.placed);
    next = r.cursor;
  }
  const x = (children[0]!.x + children[children.length - 1]!.x) / 2;
  return { placed: { node, x, depth, children }, cursor: next };
}

function all(p: Placed): Placed[] {
  return [p, ...p.children.flatMap(all)];
}

function centerY(depth: number): number {
  return PAD + NODE_H / 2 + depth * LEVEL_H;
}

function drawNode(p: Placed): string {
  const cy = centerY(p.depth);
  const w = p.node.value.length * CHAR_W;
  const parts: string[] = [];
  if (p.node.marks.includes("err")) {
    parts.push(
      `<rect class="cmn-err" x="${fmt(p.x - w / 2 - 4)}" y="${fmt(cy - 14)}" width="${fmt(w + 8)}" height="28" rx="3" fill="${COLORS.errBg}"/>`,
    );
  }
  if (p.node.circled) {
    parts.push(
      `<circle class="cmn-tree-circle" cx="${fmt(p.x)}" cy="${fmt(cy)}" r="${fmt(radius(p.node))}" fill="none" stroke="${COLORS.ink}" stroke-width="1.3"/>`,
    );
  }
  const fill = p.node.color ?? (p.node.marks.includes("hong") ? COLORS.teach : COLORS.ink);
  parts.push(
    `<text x="${fmt(p.x)}" y="${fmt(cy + FONT_SIZE * 0.35)}" font-size="${FONT_SIZE}" text-anchor="middle" fill="${fill}">${p.node.value}</text>`,
  );
  return parts.join("");
}

function drawEdges(p: Placed): string {
  const from = centerY(p.depth) + NODE_H / 2;
  return p.children
    .map((c) => {
      const to = centerY(c.depth) - (c.node.circled ? radius(c.node) : NODE_H / 2);
      return `<line class="cmn-tree-edge" x1="${fmt(p.x)}" y1="${fmt(from)}" x2="${fmt(c.x)}" y2="${fmt(to)}" stroke="${COLORS.ink}" stroke-width="1.3"/>`;
    })
    .join("");
}

export function describeFactorTree(tree: FactorTree): string {
  const splits = all(place(tree.root, 0, 0).placed)
    .filter((p) => p.children.length > 0)
    .map((p) => `${p.node.value} 分成 ${p.children.map((c) => c.node.value).join(" 和 ")}`);
  const result = tree.result.length === 0 ? "" : `；${tree.result.join("；")}`;
  return `树状图：${splits.join("，")}${result}`;
}

export function renderFactorTree(tree: FactorTree, render: RenderOptions = {}): RenderedSvg {
  const { placed, cursor } = place(tree.root, 0, PAD);
  const nodes = all(placed);
  const maxDepth = Math.max(...nodes.map((p) => p.depth));
  const body = [...nodes.map(drawEdges), ...nodes.map(drawNode)];
  let y = centerY(maxDepth) + NODE_H / 2 + PAD;
  for (const line of tree.result) {
    y += RESULT_H;
    body.push(`<text x="${PAD}" y="${fmt(y - 8)}" font-size="${RESULT_FONT}" fill="${COLORS.ink}">${line}</text>`);
  }
  const height = y + PAD / 2;
  const resultW = Math.max(0, ...tree.result.map((l) => l.length * RESULT_CHAR_W + PAD * 2));
  const width = Math.max(cursor + PAD, resultW);
  const label = describeFactorTree(tree);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="cmn-shuzhuang" role="img" aria-label="${escapeXml(label)}" style="${rootStyle(width, height, render.display ?? "inline-block")}" ` +
    `viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width / FONT_SIZE)}em" height="${fmt(height / FONT_SIZE)}em" ` +
    `font-family="'Helvetica Neue', Arial, 'PingFang SC', sans-serif">${body.join("")}</svg>`;
  return { svg, width, height, widthEm: width / FONT_SIZE, heightEm: height / FONT_SIZE, label };
}
