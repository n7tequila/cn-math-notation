/**
 * 短除法直写：`2 | 36 48 \\ 2 | 18 24 \\ 3 | 9 12 \\ 3 4`。
 * 行用 `\\` 分开；`|` 左边是除数，右边是这一行的数（空格或逗号分隔）；最后一行只写商。
 * 整个数可以用 `\err{…}`（写错）、`\hong{…}`（红色强调）包起来。
 */
import type { CellMark } from "../model.ts";
import { LayoutSyntaxError } from "../parse-layout.ts";
import type { ShortDivLayout, ShortDivRow, ShortDivTerm } from "./model.ts";

const MARKS: Readonly<Record<string, CellMark>> = { err: "err", hong: "hong", hl: "hong" };
const TERM = /\\([a-zA-Z]+)\{\s*(\d+)\s*\}|(\d+)/g;

function parseTerms(text: string): ShortDivTerm[] {
  const terms: ShortDivTerm[] = [];
  let last = 0;
  for (const m of text.matchAll(TERM)) {
    const gap = text.slice(last, m.index);
    if (!/^[\s,，]*$/.test(gap)) throw new LayoutSyntaxError(`不认识的写法 "${gap.trim()}"`);
    last = m.index + m[0].length;
    if (m[3] !== undefined) {
      terms.push({ text: m[3], marks: [] });
      continue;
    }
    const mark = MARKS[m[1]!];
    if (mark === undefined) throw new LayoutSyntaxError(`不认识的命令 \\${m[1]}`);
    terms.push({ text: m[2]!, marks: [mark] });
  }
  const rest = text.slice(last);
  if (!/^[\s,，]*$/.test(rest)) throw new LayoutSyntaxError(`不认识的写法 "${rest.trim()}"`);
  return terms;
}

function parseRow(text: string): ShortDivRow {
  const parts = text.split("|");
  if (parts.length > 2) throw new LayoutSyntaxError("一行里只能有一个 |");
  const values = parseTerms(parts[parts.length - 1]!);
  if (values.length === 0) throw new LayoutSyntaxError("这一行没有数");
  if (parts.length === 1) return { values };
  const divisor = parseTerms(parts[0]!);
  if (divisor.length !== 1) throw new LayoutSyntaxError("| 左边要写一个除数");
  return { divisor: divisor[0]!, values };
}

export function parseShortDivLayout(source: string): ShortDivLayout {
  const rows = source
    .replace(/\\nobreakspace|~/g, " ")
    .split(/\\\\/)
    .map((r) => r.trim())
    .filter((r) => r !== "")
    .map(parseRow);
  if (rows.length === 0) throw new LayoutSyntaxError("短除法至少要写一行");
  return { rows, result: [] };
}
