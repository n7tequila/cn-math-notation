/**
 * 直写布局解析：`\shushi*{…}` 花括号里的原文 → Layout。
 * 语法见 docs/design/2026-11-25-直写布局语法试写.md（R1～R9）；R10 的 & 分格（多项式竖式）见 parse-term-row.ts。
 */
import type { Cell, CellContent, CellMark, Layout, Operator, Row } from "./model.ts";
import { hasTopLevelAmpersand, parseTermRow } from "./parse-term-row.ts";

export class LayoutSyntaxError extends Error {
  override readonly name = "LayoutSyntaxError";
}

export type Token =
  | { readonly t: "cmd"; readonly name: string }
  | { readonly t: "open" }
  | { readonly t: "close" }
  | { readonly t: "newrow" }
  | { readonly t: "char"; readonly ch: string };

export const MARK_COMMANDS: Readonly<Record<string, CellMark>> = {
  tui: "tui",
  borrow: "tui",
  err: "err",
  hong: "hong",
  hl: "hong",
  bu: "bu",
  pad: "bu",
  hua: "hua",
  strike: "hua",
};

const OPERATOR_CHARS: Readonly<Record<string, Operator>> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "×": "×",
  "÷": "÷",
};
const OPERATOR_COMMANDS: Readonly<Record<string, Operator>> = { times: "×", div: "÷" };

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i += 1;
    } else if (ch === "\\") {
      const next = source[i + 1];
      if (next === "\\") {
        tokens.push({ t: "newrow" });
        i += 2;
      } else {
        const m = /^[a-zA-Z]+/.exec(source.slice(i + 1));
        if (m === null) throw new LayoutSyntaxError(`第 ${i + 1} 个字符处的反斜杠后面不是命令名`);
        tokens.push({ t: "cmd", name: m[0] });
        i += 1 + m[0].length;
      }
    } else if (ch === "{") {
      tokens.push({ t: "open" });
      i += 1;
    } else if (ch === "}") {
      tokens.push({ t: "close" });
      i += 1;
    } else {
      tokens.push({ t: "char", ch });
      i += 1;
    }
  }
  return tokens;
}

/** 按顶层的 `\\` 切成行段。 */
function splitRows(tokens: readonly Token[]): Token[][] {
  const segments: Token[][] = [[]];
  let depth = 0;
  for (const tok of tokens) {
    if (tok.t === "open") depth += 1;
    if (tok.t === "close") depth -= 1;
    if (depth < 0) throw new LayoutSyntaxError("多了一个 }");
    if (tok.t === "newrow" && depth === 0) {
      segments.push([]);
    } else {
      segments[segments.length - 1]!.push(tok);
    }
  }
  if (depth !== 0) throw new LayoutSyntaxError("花括号没有配对，少了 }");
  return segments;
}

interface RawCell {
  readonly content: CellContent;
  readonly marks: readonly CellMark[];
  readonly color?: string;
}

interface RowFlags {
  carry: boolean;
  quotient: boolean;
  divisor: string | undefined;
  operator: Operator | undefined;
}

interface Context {
  readonly marks: readonly CellMark[];
  readonly color: string | undefined;
}

class RowParser {
  private pos = 0;
  readonly flags: RowFlags = { carry: false, quotient: false, divisor: undefined, operator: undefined };

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): RawCell[] {
    return this.items(this.tokens.length, { marks: [], color: undefined }, true);
  }

  /** 读一个 {…} 组，返回组内 token 的范围终点（不含 }）。 */
  private group(what: string): { start: number; end: number } {
    const open = this.tokens[this.pos];
    if (open?.t !== "open") throw new LayoutSyntaxError(`${what} 后面要跟 {…}`);
    let depth = 0;
    for (let j = this.pos; j < this.tokens.length; j += 1) {
      const tok = this.tokens[j]!;
      if (tok.t === "open") depth += 1;
      if (tok.t === "close") {
        depth -= 1;
        if (depth === 0) {
          const range = { start: this.pos + 1, end: j };
          this.pos = j + 1;
          return range;
        }
      }
    }
    throw new LayoutSyntaxError(`${what} 的花括号没有配对`);
  }

  private groupText(what: string): string {
    const { start, end } = this.group(what);
    return this.tokens
      .slice(start, end)
      .map((tok) => (tok.t === "char" ? tok.ch : tok.t === "cmd" ? `\\${tok.name}` : ""))
      .join("");
  }

  private subItems(what: string, ctx: Context): RawCell[] {
    const { start, end } = this.group(what);
    const saved = this.pos;
    this.pos = start;
    const cells = this.items(end, ctx, false);
    this.pos = saved;
    return cells;
  }

  private items(end: number, ctx: Context, rowLevel: boolean): RawCell[] {
    const cells: RawCell[] = [];
    while (this.pos < end) {
      const tok = this.tokens[this.pos]!;
      const atRowStart = rowLevel && cells.length === 0 && this.flags.operator === undefined;
      if (tok.t === "char") {
        this.pos += 1;
        cells.push(...this.charCell(tok.ch, ctx, atRowStart));
      } else if (tok.t === "cmd") {
        this.pos += 1;
        cells.push(...this.command(tok.name, ctx, atRowStart, cells.length === 0));
      } else if (tok.t === "open") {
        cells.push(...this.subItems("{", ctx));
      } else {
        throw new LayoutSyntaxError("多了一个 }");
      }
    }
    return cells;
  }

  private charCell(ch: string, ctx: Context, atRowStart: boolean): RawCell[] {
    if (/[0-9]/.test(ch)) return [cell({ kind: "digit", text: ch }, ctx)];
    if (ch === ".") return [cell({ kind: "point" }, ctx)];
    if (ch === "~") return [cell({ kind: "blank" }, ctx)];
    const op = OPERATOR_CHARS[ch];
    if (op !== undefined) return this.operator(op, atRowStart);
    throw new LayoutSyntaxError(`不认识的字符 "${ch}"`);
  }

  private operator(op: Operator, atRowStart: boolean): RawCell[] {
    if (this.flags.carry) throw new LayoutSyntaxError("进位行（\\jin）里不能有运算符");
    if (!atRowStart) throw new LayoutSyntaxError(`运算符 ${op} 只能写在一行的开头`);
    this.flags.operator = op;
    return [];
  }

  private command(name: string, ctx: Context, atRowStart: boolean, noCellsYet: boolean): RawCell[] {
    const mark = MARK_COMMANDS[name];
    if (mark !== undefined) {
      return this.subItems(`\\${name}`, { ...ctx, marks: [...ctx.marks, mark] });
    }
    const op = OPERATOR_COMMANDS[name];
    if (op !== undefined) return this.operator(op, atRowStart);
    switch (name) {
      case "textcolor": {
        const color = this.groupText("\\textcolor 的颜色").trim();
        if (!/^[#a-zA-Z0-9]+$/.test(color)) throw new LayoutSyntaxError(`颜色写法不对："${color}"`);
        return this.subItems("\\textcolor", { ...ctx, color });
      }
      case "jin":
      case "carry":
        this.flags.carry = true;
        return this.subItems(`\\${name}`, ctx);
      case "shang":
        if (!noCellsYet) throw new LayoutSyntaxError("\\shang 只能写在一行的开头");
        this.flags.quotient = true;
        return [];
      case "chu": {
        if (!noCellsYet) throw new LayoutSyntaxError("\\chu 只能写在一行的开头");
        const divisor = this.groupText("\\chu").trim();
        if (!/^[0-9.]+$/.test(divisor)) throw new LayoutSyntaxError(`除数只能是数字，收到 "${divisor}"`);
        this.flags.divisor = divisor;
        return [];
      }
      case "hline":
        throw new LayoutSyntaxError("\\hline 要单独放在两行之间（写在 \\\\ 之后、下一行之前）");
      default:
        throw new LayoutSyntaxError(`不认识的命令 \\${name}`);
    }
  }
}

function cell(content: CellContent, ctx: Context): RawCell {
  return ctx.color === undefined ? { content, marks: ctx.marks } : { content, marks: ctx.marks, color: ctx.color };
}

/** 给一行的格子编列号：有小数点按小数点，否则按最右一格为个位。 */
export function assignColumns(raw: readonly RawCell[]): Cell[] {
  const points = raw.flatMap((c, i) => (c.content.kind === "point" ? [i] : []));
  if (points.length > 1) throw new LayoutSyntaxError("一行里出现了两个小数点");
  const p = points[0];
  return raw.map((c, i) => {
    let col: number;
    if (p === undefined) col = raw.length - 1 - i;
    else if (i < p) col = p - 1 - i;
    else if (i === p) col = -0.5;
    else col = -(i - p);
    return { col, ...c };
  });
}

function buildRow(raw: RawCell[], flags: RowFlags): Row {
  const cells = assignColumns(raw);
  if (flags.carry) {
    if (flags.operator !== undefined || flags.quotient || flags.divisor !== undefined) {
      throw new LayoutSyntaxError("进位行（\\jin）里不能再有运算符、\\shang 或 \\chu");
    }
    if (cells.some((c) => c.content.kind === "point")) throw new LayoutSyntaxError("进位行里不能有小数点");
    return { kind: "carry", cells };
  }
  if (cells.length === 0) throw new LayoutSyntaxError("这一行没有数字");
  return {
    kind: "digits",
    cells,
    ...(flags.operator === undefined ? {} : { operator: flags.operator }),
    ...(flags.quotient ? { quotient: true as const } : {}),
    ...(flags.divisor === undefined ? {} : { divisor: flags.divisor }),
  };
}

export function parseLayout(source: string): Layout {
  const rows: Row[] = [];
  for (const segment of splitRows(tokenize(source))) {
    let k = 0;
    while (segment[k]?.t === "cmd" && (segment[k] as { name: string }).name === "hline") {
      rows.push({ kind: "hline" });
      k += 1;
    }
    const rest = segment.slice(k);
    if (rest.length === 0) continue;
    if (hasTopLevelAmpersand(rest)) {
      rows.push(parseTermRow(rest));
      continue;
    }
    const parser = new RowParser(rest);
    const raw = parser.parse();
    rows.push(buildRow(raw, parser.flags));
  }
  if (!rows.some((r) => r.kind === "digits")) throw new LayoutSyntaxError("竖式里至少要有一行数字");
  const hasDecimal = rows.some((r) => r.kind !== "hline" && r.cells.some((c) => c.content.kind === "point"));
  return { rows, hasDecimal };
}
