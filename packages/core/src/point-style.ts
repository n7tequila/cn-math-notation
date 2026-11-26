/**
 * 小数点写法：默认写在两个数字中间的空隙里、不占列（维护者 2026-11-26 定，与小数乘除一致）；
 * 选项 pointColumn 恢复“小数点单独占一条窄列”（加减法样本的写法）。
 *
 * 布局模型（语义式加减、直写布局）仍按 -0.5 列记小数点；渲染、导出前用 toGapPoints 转换。
 */
import type { Cell, Layout, Row } from "./model.ts";

/** 小数位数最多的一行有几位小数（最低列的相反数）。 */
function fractionWidth(layout: Layout): number {
  let low = 0;
  for (const row of layout.rows) {
    if (row.kind === "hline") continue;
    for (const c of row.cells) if (Number.isInteger(c.col)) low = Math.min(low, c.col);
  }
  return -low;
}

function convertCells(cells: readonly Cell[], shift: number): Cell[] {
  const pointCell = cells.find((c) => c.content.kind === "point");
  const moved = cells.filter((c) => c.content.kind !== "point").map((c) => ({ ...c, col: c.col + shift }));
  if (pointCell === undefined) return moved;
  const point = pointCell.marks.includes("hong") ? "hong" : "dot";
  const onesCol = shift;
  if (moved.some((c) => c.col === onesCol)) {
    return moved.map((c) => (c.col === onesCol ? { ...c, point } : c));
  }
  // 没有个位（如直写的 .5）：放一个空格子承载小数点
  const holder: Cell = { col: onesCol, content: { kind: "blank" }, marks: [], point };
  return [...moved, holder].sort((a, b) => b.col - a.col);
}

/** 把“小数点占列”的布局换成空隙小数点：整数列整体右移小数位数，小数点并到个位那一格。 */
export function toGapPoints(layout: Layout): Layout {
  if (!layout.hasDecimal) return layout;
  const shift = fractionWidth(layout);
  const rows: Row[] = layout.rows.map((row) =>
    row.kind === "hline" ? row : { ...row, cells: convertCells(row.cells, shift) },
  );
  return { rows, hasDecimal: false };
}
