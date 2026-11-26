/**
 * 树状图语义式：给一个数，按 split 拆到全是质数。
 * - prime（默认）：每步拆出最小质数，质数在左、另一边继续拆（与短除法步骤一一对应，设计草案 §10.2）。
 * - half：每步拆成最接近的两个因数（不超过 √n 的最大因数在左）。
 */
import { isPrime, largestFactorBelowRoot, smallestPrimeFactor } from "../number-theory.ts";
import { ExpressionError } from "../semantic/numbers.ts";
import type { FactorTree, FactorTreeNode } from "./model.ts";
import type { FactorSplit, FactorTreeOptions } from "./options.ts";
import { resultLine } from "./result.ts";

const MAX_VALUE = 1_000_000;

function parseValue(source: string): number {
  const text = source.replace(/\\nobreakspace|~|\s+/g, "");
  if (!/^\d+$/.test(text)) throw new ExpressionError(`树状图要写一个正整数，收到 "${source.trim()}"`);
  const n = Number(text);
  if (n < 2) throw new ExpressionError(`${text} 太小，不能分解`);
  if (n > MAX_VALUE) throw new ExpressionError(`${text} 太大（上限 ${MAX_VALUE}）`);
  if (isPrime(n)) throw new ExpressionError(`${text} 是质数，不用分解`);
  return n;
}

function grow(n: number, split: FactorSplit, circle: boolean): FactorTreeNode {
  if (isPrime(n)) return { value: String(n), children: [], circled: circle, marks: [] };
  const left = split === "prime" ? smallestPrimeFactor(n) : largestFactorBelowRoot(n);
  return {
    value: String(n),
    children: [grow(left, split, circle), grow(n / left, split, circle)],
    circled: false,
    marks: [],
  };
}

export function buildFactorTreeFrom(source: string, opts: FactorTreeOptions): FactorTree {
  const root = grow(parseValue(source), opts.split, opts.circle);
  return { root, result: opts.result ? [resultLine(root)] : [] };
}
