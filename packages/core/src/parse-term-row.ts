/**
 * 直写布局的 & 分格（设计草案直写语法 R10，多项式竖式用，维护者 2026-11-26）：
 * 一行用 & 分成若干格，每格写一整项（如 x^2、+3x、-1）；各格从右往左依次是第 0、1、2… 列（列号 = 次数），
 * 空着的格是缺项。第一格前面可以写 \shang（商行）、\chu{除式}（被除式行）、\times / \div（运算符）；
 * 运算符也可以单独占第一格（如 `\times & 2x & +1`）。整项可用 \err{…}、\hong{…}、\hua{…}、\bu{…} 包起来。
 */
import type { Cell, CellMark, DigitRow, Operator } from "./model.ts";
import { prettyTerm } from "./math-text.ts";
import { LayoutSyntaxError, MARK_COMMANDS, type Token } from "./parse-layout.ts";

const OPERATOR_COMMANDS: Readonly<Record<string, Operator>> = { times: "×", div: "÷" };
const OPERATOR_CHARS: Readonly<Record<string, Operator>> = { "+": "+", "-": "-", "−": "-", "×": "×", "÷": "÷" };
const TERM_CHARS = /^[0-9a-zA-Z+\-−^{}.]+$/;

export function hasTopLevelAmpersand(tokens: readonly Token[]): boolean {
  let depth = 0;
  for (const tok of tokens) {
    if (tok.t === "open") depth += 1;
    if (tok.t === "close") depth -= 1;
    if (tok.t === "char" && tok.ch === "&" && depth === 0) return true;
  }
  return false;
}

function splitCells(tokens: readonly Token[]): Token[][] {
  const out: Token[][] = [[]];
  let depth = 0;
  for (const tok of tokens) {
    if (tok.t === "open") depth += 1;
    if (tok.t === "close") depth -= 1;
    if (tok.t === "char" && tok.ch === "&" && depth === 0) out.push([]);
    else out[out.length - 1]!.push(tok);
  }
  return out;
}

function tokensText(tokens: readonly Token[]): string {
  return tokens
    .map((tok) => (tok.t === "char" ? tok.ch : tok.t === "cmd" ? `\\${tok.name}` : tok.t === "open" ? "{" : tok.t === "close" ? "}" : ""))
    .join("");
}

/** 读一个 {…} 组：返回组内 token 与组后剩下的 token。 */
function group(tokens: readonly Token[], what: string): { inner: Token[]; rest: Token[] } {
  if (tokens[0]?.t !== "open") throw new LayoutSyntaxError(`${what} 后面要跟 {…}`);
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i]!;
    if (tok.t === "open") depth += 1;
    if (tok.t === "close") depth -= 1;
    if (depth === 0) return { inner: tokens.slice(1, i), rest: tokens.slice(i + 1) };
  }
  throw new LayoutSyntaxError(`${what} 的花括号没有配对`);
}

interface Prefix {
  readonly quotient: boolean;
  readonly divisor?: string;
  readonly operator?: Operator;
  readonly rest: Token[];
}

/** 剥掉第一格前面的 \shang、\chu{…}、运算符。 */
function stripPrefix(tokens: readonly Token[]): Prefix {
  let rest = [...tokens];
  let quotient = false;
  let divisor: string | undefined;
  let operator: Operator | undefined;
  for (;;) {
    const tok = rest[0];
    if (tok?.t === "cmd" && tok.name === "shang") {
      quotient = true;
      rest = rest.slice(1);
    } else if (tok?.t === "cmd" && tok.name === "chu") {
      const g = group(rest.slice(1), "\\chu");
      divisor = prettyTerm(tokensText(g.inner));
      rest = g.rest;
    } else if (tok?.t === "cmd" && OPERATOR_COMMANDS[tok.name] !== undefined) {
      operator = OPERATOR_COMMANDS[tok.name];
      rest = rest.slice(1);
    } else if (tok?.t === "char" && OPERATOR_CHARS[tok.ch] !== undefined && rest.length === 1) {
      operator = OPERATOR_CHARS[tok.ch];
      rest = [];
    } else {
      break;
    }
  }
  return { quotient, ...(divisor === undefined ? {} : { divisor }), ...(operator === undefined ? {} : { operator }), rest };
}

function termCell(tokens: readonly Token[], col: number): Cell {
  if (tokens.length === 0) return { col, content: { kind: "blank" }, marks: [] };
  const head = tokens[0]!;
  if (head.t === "cmd" && MARK_COMMANDS[head.name] !== undefined) {
    const g = group(tokens.slice(1), `\\${head.name}`);
    if (g.rest.length > 0) throw new LayoutSyntaxError(`\\${head.name}{…} 要包住整格`);
    const inner = termCell(g.inner, col);
    const mark: CellMark = MARK_COMMANDS[head.name]!;
    return { ...inner, marks: [...inner.marks, mark] };
  }
  const raw = tokensText(tokens);
  if (!TERM_CHARS.test(raw)) throw new LayoutSyntaxError(`一格里只能写一项（数字、字母、^次数、正负号）：“${raw}”`);
  return { col, content: { kind: "term", text: prettyTerm(raw) }, marks: [] };
}

export function parseTermRow(tokens: readonly Token[]): DigitRow {
  const cells = splitCells(tokens);
  const prefix = stripPrefix(cells[0]!);
  const strippedSomething = prefix.quotient || prefix.divisor !== undefined || prefix.operator !== undefined;
  const items = prefix.rest.length === 0 && strippedSomething ? cells.slice(1) : [prefix.rest, ...cells.slice(1)];
  const row = items.map((item, i) => termCell(item, items.length - 1 - i));
  if (row.every((c) => c.content.kind === "blank")) throw new LayoutSyntaxError("这一行没有项");
  return {
    kind: "digits",
    cells: row,
    ...(prefix.operator === undefined ? {} : { operator: prefix.operator }),
    ...(prefix.quotient ? { quotient: true as const } : {}),
    ...(prefix.divisor === undefined ? {} : { divisor: prefix.divisor }),
  };
}
