import type { FactorTreeNode } from "./model.ts";

function leaves(node: FactorTreeNode): string[] {
  return node.children.length === 0 ? [node.value] : node.children.flatMap(leaves);
}

/** 结果算式：叶子从小到大相乘，如 36 = 2×2×3×3。 */
export function resultLine(root: FactorTreeNode): string {
  const factors = leaves(root).sort((a, b) => Number(a) - Number(b));
  return `${root.value} = ${factors.join("×")}`;
}
