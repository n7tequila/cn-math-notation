/** 分解质因数树状图的模型（设计草案 §10.2）：每个数是一个节点，拆开的数有两个（或更多）孩子。 */
import type { CellMark } from "../model.ts";

export interface FactorTreeNode {
  readonly value: string;
  readonly children: readonly FactorTreeNode[];
  /** 画圈（质数叶子，circle 选项开时）。 */
  readonly circled: boolean;
  readonly marks: readonly CellMark[];
  readonly color?: string;
}

export interface FactorTree {
  readonly root: FactorTreeNode;
  /** 写在下面的结果算式（result 选项）。 */
  readonly result: readonly string[];
}
