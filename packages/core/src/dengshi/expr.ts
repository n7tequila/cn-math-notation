/**
 * 递等式（脱式计算）的算式：解析成语法树、按课本运算顺序逐步化简、写回 TeX。
 *
 * 运算顺序（课本）：有括号先算括号里面的（小括号 → 中括号，由里往外）；
 * 同一层先乘除、后加减；同级从左往右。互不影响的几处在同一步里一起算
 * （如 25×4+36÷6 → 100+6；(12+8)×(5-3) → 20×2），但括号外的运算要等括号都算完。
 * 整数、小数都可以（定点数精确计算）；除法要能除尽。负数默认允许（维护者 2026-11-27），
 * negative=false 时不允许。题目里写的数照原样写回（3.50 仍是 3.50），算出来的数去掉末尾的 0。
 */
import { ExpressionError } from "../semantic/numbers.ts";
import { decDiv, decFromText, decText, isNegative, type Dec } from "./decimal.ts";

export type BinOp = "+" | "-" | "×" | "÷";
export type Bracket = "(" | "[";

export type Node =
  /** text：题目里写的原样（算出来的数没有）；bracketed：题目里给这个负数加了括号，照原样写回。 */
  | { readonly k: "num"; readonly v: Dec; readonly text?: string; readonly bracketed?: boolean }
  | { readonly k: "op"; readonly op: BinOp; readonly l: Node; readonly r: Node }
  | { readonly k: "paren"; readonly br: Bracket; readonly inner: Node };

type Token =
  | { readonly t: "num"; readonly text: string }
  | { readonly t: "op"; readonly op: BinOp }
  | { readonly t: "open" | "close"; readonly br: Bracket };

const SYMBOLS: readonly [RegExp, (m: string) => Token][] = [
  [/^\d+(?:\.\d+)?/, (m) => ({ t: "num", text: m })],
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
    const hit = SYMBOLS.find(([re]) => re.test(rest));
    if (hit === undefined) throw new ExpressionError(`不认识的符号：“${rest}”`);
    const m = hit[0].exec(rest)![0];
    tokens.push(hit[1](m));
    rest = rest.slice(m.length);
  }
  return tokens;
}

/** 递归下降：expr := term (± term)*；term := factor (×÷ factor)*；factor := 数 | (expr) | [expr]。 */
export function parseArith(source: string, opts: ArithOptions = DEFAULT_ARITH): Node {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];

  /** 负号只在算式开头或紧跟左括号时表示负数，后面必须是一个数【推论】。 */
  const signedNumber = (leading: boolean): Node | undefined => {
    const tok = peek();
    if (tok?.t !== "op" || tok.op !== "-") return undefined;
    if (!leading) throw new ExpressionError("负数要加括号，比如 5×(-2)");
    const next = tokens[pos + 1];
    if (next?.t !== "num") throw new ExpressionError("负号后面要跟一个数");
    if (!opts.negative) throw new ExpressionError("不处理负数（negative=false）");
    pos += 2;
    return { k: "num", v: decFromText(`-${next.text}`), text: `-${next.text}` };
  };

  const factor = (leading: boolean): Node => {
    const signed = signedNumber(leading);
    if (signed !== undefined) return signed;
    const tok = peek();
    if (tok === undefined) throw new ExpressionError("算式不完整：结尾少了一个数");
    if (tok.t === "num") {
      pos += 1;
      return { k: "num", v: decFromText(tok.text), text: tok.text };
    }
    if (tok.t === "open") {
      pos += 1;
      const inner = expr(true);
      const close = peek();
      if (close?.t !== "close" || close.br !== tok.br) {
        throw new ExpressionError(tok.br === "(" ? "小括号没有配对" : "中括号没有配对");
      }
      pos += 1;
      // 括号只包着一个负数（如 (-3)）：这是负数的写法，不是要先算的括号
      if (inner.k === "num" && isNegative(inner.v)) return { ...inner, bracketed: tok.br === "(" };
      return { k: "paren", br: tok.br, inner };
    }
    throw new ExpressionError(tok.t === "close" ? "多了一个右括号" : "运算符前面少了一个数");
  };

  const chain = (next: (leading: boolean) => Node, ops: readonly BinOp[]) => (leading: boolean): Node => {
    let node = next(leading);
    for (let tok = peek(); tok?.t === "op" && ops.includes(tok.op); tok = peek()) {
      pos += 1;
      node = { k: "op", op: tok.op, l: node, r: next(false) };
    }
    return node;
  };
  const term = chain(factor, ["×", "÷"]);
  const expr = chain(term, ["+", "-"]);

  const root = expr(true);
  if (pos < tokens.length) {
    const tok = tokens[pos]!;
    throw new ExpressionError(tok.t === "close" ? "多了一个右括号" : "两个数之间少了运算符");
  }
  return root;
}

export interface ArithOptions {
  /** 是否允许负数（维护者 2026-11-27：默认允许）。 */
  readonly negative: boolean;
}

export const DEFAULT_ARITH: ArithOptions = { negative: true };

const OP_TEXT: Readonly<Record<BinOp, string>> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };

function compute(op: BinOp, a: Dec, b: Dec, opts: ArithOptions): Dec {
  const result = rawCompute(op, a, b);
  if (!opts.negative && isNegative(result)) {
    throw new ExpressionError(`${decText(a)}${OP_TEXT[op]}${decText(b)} 得负数（negative=false 时不处理负数）`);
  }
  return result;
}

function rawCompute(op: BinOp, a: Dec, b: Dec): Dec {
  const scale = Math.max(a.scale, b.scale);
  const x = a.n * 10n ** BigInt(scale - a.scale);
  const y = b.n * 10n ** BigInt(scale - b.scale);
  switch (op) {
    case "+":
      return { n: x + y, scale };
    case "-":
      return { n: x - y, scale };
    case "×":
      return { n: a.n * b.n, scale: a.scale + b.scale };
    case "÷": {
      if (b.n === 0n) throw new ExpressionError("除数不能是 0");
      const q = decDiv(x, y);
      if (q === undefined) {
        throw new ExpressionError(`${decText(a)}÷${decText(b)} 除不尽；要写近似值或循环小数，请用直写 \\dengshi*`);
      }
      return q;
    }
  }
}

function containsParen(n: Node): boolean {
  return n.k === "paren" || (n.k === "op" && (containsParen(n.l) || containsParen(n.r)));
}

function containsOp(n: Node, ops: readonly BinOp[]): boolean {
  return n.k === "op" && (ops.includes(n.op) || containsOp(n.l, ops) || containsOp(n.r, ops));
}

/** 把两个子节点都是数、且属于 ops 的运算全部算掉（同一步里互不影响的几处一起算）。 */
function reduceReady(n: Node, ops: readonly BinOp[], opts: ArithOptions): Node {
  if (n.k !== "op") return n;
  if (ops.includes(n.op) && n.l.k === "num" && n.r.k === "num") return { k: "num", v: compute(n.op, n.l.v, n.r.v, opts) };
  return { ...n, l: reduceReady(n.l, ops, opts), r: reduceReady(n.r, ops, opts) };
}

/** 一层（括号外或某个括号内）往前算一步。 */
function stepScope(n: Node, opts: ArithOptions): Node {
  if (containsParen(n)) return stepParens(n, opts);
  return containsOp(n, ["×", "÷"]) ? reduceReady(n, ["×", "÷"], opts) : reduceReady(n, ["+", "-"], opts);
}

/** 有括号时只算括号里面：各个括号各自往前一步，算成一个数时去掉括号。 */
function stepParens(n: Node, opts: ArithOptions): Node {
  if (n.k === "paren") {
    const inner = stepScope(n.inner, opts);
    return inner.k === "num" ? inner : { ...n, inner };
  }
  if (n.k === "op") return { ...n, l: stepParens(n.l, opts), r: stepParens(n.r, opts) };
  return n;
}

const MAX_STEPS = 100;

/** 逐步化简，返回每一步的语法树（第一项是原式，最后一项是结果）。 */
export function simplifySteps(root: Node, opts: ArithOptions = DEFAULT_ARITH): Node[] {
  const steps = [root];
  let cur = root;
  while (cur.k !== "num") {
    if (steps.length > MAX_STEPS) throw new ExpressionError("算式太长了");
    cur = stepScope(cur, opts);
    steps.push(cur);
  }
  if (steps.length === 1) throw new ExpressionError("只有一个数，不需要递等式");
  return steps;
}

/** 除号直接写 ÷：MathJax 的 physics 宏包（Typora、出图服务都加载）把 \div 改成了散度 ∇·。 */
const OP_TEX: Readonly<Record<BinOp, string>> = { "+": "+", "-": "-", "×": "\\times ", "÷": "÷" };

/**
 * 语法树 → TeX（括号都来自原式，照原样写回）。
 * leading：在算式开头或紧跟左括号；负数在这里不加括号，其余位置写成 (-2)。
 */
export function toTex(n: Node, leading = true): string {
  switch (n.k) {
    case "num": {
      const text = n.text ?? decText(n.v);
      if (n.bracketed === true || (isNegative(n.v) && !leading)) return `(${text})`;
      // aligned 第二列开头有空组，裸的 "-" 会排成减号；包一层花括号排成负号
      return isNegative(n.v) ? `{${text}}` : text;
    }
    case "op":
      return `${toTex(n.l, leading)}${OP_TEX[n.op]}${toTex(n.r, false)}`;
    case "paren":
      return n.br === "(" ? `(${toTex(n.inner)})` : `[${toTex(n.inner)}]`;
  }
}
