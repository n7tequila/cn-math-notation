/**
 * 递等式（脱式计算）的算式：解析成语法树、按课本运算顺序逐步化简、写回 TeX。
 *
 * 运算顺序（课本）：有括号先算括号里面的（小括号 → 中括号，由里往外）；
 * 同一层先乘除、后加减；同级从左往右。互不影响的几处在同一步里一起算
 * （如 25×4+36÷6 → 100+6；(12+8)×(5-3) → 20×2），但括号外的运算要等括号都算完。
 * 第一期只做整数；减法不能出现负数，除法要能整除。
 */
import { ExpressionError } from "../semantic/numbers.ts";

export type BinOp = "+" | "-" | "×" | "÷";
export type Bracket = "(" | "[";

export type Node =
  | { readonly k: "num"; readonly v: bigint }
  | { readonly k: "op"; readonly op: BinOp; readonly l: Node; readonly r: Node }
  | { readonly k: "paren"; readonly br: Bracket; readonly inner: Node };

type Token = { readonly t: "num"; readonly v: bigint } | { readonly t: "op"; readonly op: BinOp } | { readonly t: "open" | "close"; readonly br: Bracket };

const SYMBOLS: readonly [RegExp, (m: string) => Token][] = [
  [/^\d+/, (m) => ({ t: "num", v: BigInt(m) })],
  [/^\+/, () => ({ t: "op", op: "+" })],
  [/^(?:-|−)/, () => ({ t: "op", op: "-" })],
  [/^(?:\\times|×|\*)/, () => ({ t: "op", op: "×" })],
  [/^(?:\\div|÷|\/)/, () => ({ t: "op", op: "÷" })],
  [/^(?:\\left)?(?:\(|（)/, () => ({ t: "open", br: "(" })],
  [/^(?:\\right)?(?:\)|）)/, () => ({ t: "close", br: "(" })],
  [/^(?:\\left)?(?:\[|［|\\lbrack)/, () => ({ t: "open", br: "[" })],
  [/^(?:\\right)?(?:\]|］|\\rbrack)/, () => ({ t: "close", br: "[" })],
];

function tokenize(source: string): Token[] {
  let rest = source.replace(/\\nobreakspace|~|\s+/g, "");
  if (rest === "") throw new ExpressionError("算式是空的");
  const tokens: Token[] = [];
  while (rest !== "") {
    // 小数要先于整数判断
    const decimal = /^\d+\.\d+/.exec(rest);
    if (decimal !== null) throw new ExpressionError("小数的递等式属第二期");
    const hit = SYMBOLS.find(([re]) => re.test(rest));
    if (hit === undefined) throw new ExpressionError(`不认识的符号：“${rest}”`);
    const m = hit[0].exec(rest)![0];
    tokens.push(hit[1](m));
    rest = rest.slice(m.length);
  }
  return tokens;
}

/** 递归下降：expr := term (± term)*；term := factor (×÷ factor)*；factor := 数 | (expr) | [expr]。 */
export function parseArith(source: string): Node {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];

  const factor = (): Node => {
    const tok = peek();
    if (tok === undefined) throw new ExpressionError("算式不完整：结尾少了一个数");
    if (tok.t === "num") {
      pos += 1;
      return { k: "num", v: tok.v };
    }
    if (tok.t === "open") {
      pos += 1;
      const inner = expr();
      const close = peek();
      if (close?.t !== "close" || close.br !== tok.br) {
        throw new ExpressionError(tok.br === "(" ? "小括号没有配对" : "中括号没有配对");
      }
      pos += 1;
      return { k: "paren", br: tok.br, inner };
    }
    throw new ExpressionError(tok.t === "close" ? "多了一个右括号" : "运算符前面少了一个数");
  };

  const chain = (next: () => Node, ops: readonly BinOp[]) => (): Node => {
    let node = next();
    for (let tok = peek(); tok?.t === "op" && ops.includes(tok.op); tok = peek()) {
      pos += 1;
      node = { k: "op", op: tok.op, l: node, r: next() };
    }
    return node;
  };
  const term = chain(factor, ["×", "÷"]);
  const expr = chain(term, ["+", "-"]);

  const root = expr();
  if (pos < tokens.length) {
    const tok = tokens[pos]!;
    throw new ExpressionError(tok.t === "close" ? "多了一个右括号" : "两个数之间少了运算符");
  }
  return root;
}

function compute(op: BinOp, a: bigint, b: bigint): bigint {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      if (a < b) throw new ExpressionError(`${a}−${b} 得负数，小学递等式不处理负数`);
      return a - b;
    case "×":
      return a * b;
    case "÷":
      if (b === 0n) throw new ExpressionError("除数不能是 0");
      if (a % b !== 0n) throw new ExpressionError(`${a}÷${b} 除不尽，递等式里的除法要能整除`);
      return a / b;
  }
}

function containsParen(n: Node): boolean {
  return n.k === "paren" || (n.k === "op" && (containsParen(n.l) || containsParen(n.r)));
}

function containsOp(n: Node, ops: readonly BinOp[]): boolean {
  return n.k === "op" && (ops.includes(n.op) || containsOp(n.l, ops) || containsOp(n.r, ops));
}

/** 把两个子节点都是数、且属于 ops 的运算全部算掉（同一步里互不影响的几处一起算）。 */
function reduceReady(n: Node, ops: readonly BinOp[]): Node {
  if (n.k !== "op") return n;
  if (ops.includes(n.op) && n.l.k === "num" && n.r.k === "num") return { k: "num", v: compute(n.op, n.l.v, n.r.v) };
  return { ...n, l: reduceReady(n.l, ops), r: reduceReady(n.r, ops) };
}

/** 一层（括号外或某个括号内）往前算一步。 */
function stepScope(n: Node): Node {
  if (containsParen(n)) return stepParens(n);
  return containsOp(n, ["×", "÷"]) ? reduceReady(n, ["×", "÷"]) : reduceReady(n, ["+", "-"]);
}

/** 有括号时只算括号里面：各个括号各自往前一步，算成一个数时去掉括号。 */
function stepParens(n: Node): Node {
  if (n.k === "paren") {
    const inner = stepScope(n.inner);
    return inner.k === "num" ? inner : { ...n, inner };
  }
  if (n.k === "op") return { ...n, l: stepParens(n.l), r: stepParens(n.r) };
  return n;
}

const MAX_STEPS = 100;

/** 逐步化简，返回每一步的语法树（第一项是原式，最后一项是结果）。 */
export function simplifySteps(root: Node): Node[] {
  const steps = [root];
  let cur = root;
  while (cur.k !== "num") {
    if (steps.length > MAX_STEPS) throw new ExpressionError("算式太长了");
    cur = stepScope(cur);
    steps.push(cur);
  }
  if (steps.length === 1) throw new ExpressionError("只有一个数，不需要递等式");
  return steps;
}

const OP_TEX: Readonly<Record<BinOp, string>> = { "+": "+", "-": "-", "×": "\\times ", "÷": "\\div " };

/** 语法树 → TeX（括号都来自原式，照原样写回）。 */
export function toTex(n: Node): string {
  switch (n.k) {
    case "num":
      return n.v.toString();
    case "op":
      return `${toTex(n.l)}${OP_TEX[n.op]}${toTex(n.r)}`;
    case "paren":
      return n.br === "(" ? `(${toTex(n.inner)})` : `[${toTex(n.inner)}]`;
  }
}
