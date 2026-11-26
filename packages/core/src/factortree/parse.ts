/**
 * 树状图直写：`36 = 4 \times 9 \\ 4 = 2 \times 2 \\ 9 = 3 \times 3`。
 * 每条（用 `\\` 分开）拆树上的一个数；第一条的左边是根。有几个相同的数时，先拆最左边还没拆的那个。
 * 程序不检查拆得对不对（照孩子写的画）；只有真是质数的叶子才画圈。数可以用 `\err{…}`、`\hong{…}` 包起来。
 */
import type { CellMark } from "../model.ts";
import { isPrime } from "../number-theory.ts";
import { LayoutSyntaxError } from "../parse-layout.ts";
import type { FactorTree, FactorTreeNode } from "./model.ts";
import { resultLine } from "./result.ts";

const MARKS: Readonly<Record<string, CellMark>> = { err: "err", hong: "hong", hl: "hong" };

interface Term {
  readonly value: string;
  readonly marks: readonly CellMark[];
}

function parseTerm(text: string): Term {
  const t = text.trim();
  const m = /^\\([a-zA-Z]+)\{\s*(\d+)\s*\}$/.exec(t);
  if (m !== null) {
    const mark = MARKS[m[1]!];
    if (mark === undefined) throw new LayoutSyntaxError(`不认识的命令 \\${m[1]}`);
    return { value: m[2]!, marks: [mark] };
  }
  if (!/^\d+$/.test(t)) throw new LayoutSyntaxError(`"${t}" 不是数`);
  return { value: t, marks: [] };
}

interface Split {
  readonly parent: Term;
  readonly parts: readonly Term[];
}

function parseLine(line: string): Split {
  const sides = line.split("=");
  if (sides.length !== 2) throw new LayoutSyntaxError(`每条要写成“数 = 因数 × 因数”：“${line.trim()}”`);
  const parts = sides[1]!.split(/\\times|×|\*/).map(parseTerm);
  if (parts.length < 2) throw new LayoutSyntaxError(`等号右边至少要有两个因数：“${line.trim()}”`);
  return { parent: parseTerm(sides[0]!), parts };
}

/** 搭建中的树（叶子还没决定画不画圈）。 */
interface Draft {
  readonly term: Term;
  readonly children: readonly Draft[];
}

/** 把最左边还没拆的 value 拆成 parts，返回新树；没找到返回 undefined。 */
function expand(node: Draft, value: string, parts: readonly Term[]): Draft | undefined {
  if (node.children.length === 0) {
    return node.term.value === value ? { term: node.term, children: parts.map((term) => ({ term, children: [] })) } : undefined;
  }
  for (let i = 0; i < node.children.length; i += 1) {
    const replaced = expand(node.children[i]!, value, parts);
    if (replaced !== undefined) {
      return { term: node.term, children: node.children.map((c, j) => (j === i ? replaced : c)) };
    }
  }
  return undefined;
}

function freeze(node: Draft, circle: boolean): FactorTreeNode {
  const children = node.children.map((c) => freeze(c, circle));
  const leafPrime = children.length === 0 && isPrime(Number(node.term.value));
  return { value: node.term.value, children, circled: circle && leafPrime, marks: node.term.marks };
}

export function parseFactorTreeLayout(source: string, circle = true, result = false): FactorTree {
  const lines = source
    .replace(/\\nobreakspace|~/g, " ")
    .split(/\\\\/)
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .map(parseLine);
  if (lines.length === 0) throw new LayoutSyntaxError("树状图至少要写一条“数 = 因数 × 因数”");
  const start: Draft = { term: lines[0]!.parent, children: [] };
  const tree = lines.reduce((acc, { parent, parts }) => {
    const next = expand(acc, parent.value, parts);
    if (next === undefined) throw new LayoutSyntaxError(`${parent.value} 不在树上（或已经拆过了）`);
    return next;
  }, start);
  const frozen = freeze(tree, circle);
  return { root: frozen, result: result ? [resultLine(frozen)] : [] };
}
