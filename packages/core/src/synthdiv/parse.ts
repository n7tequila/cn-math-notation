/**
 * 综合除法直写：`-1 | 1 & 3 & 2 \\ & -1 & -2 \\ 1 & 2 & 0`。
 * 三行：第一行“根 | 各项系数”；第二行乘积（第一格空着）；第三行结果（最后一格是余数）。三行格数相同。
 * 一格只能写一个整数；可用 `\err{…}`、`\hong{…}` 包起来。
 */
import type { CellMark } from "../model.ts";
import { LayoutSyntaxError } from "../parse-layout.ts";
import type { SynthDivLayout, SynthTerm } from "./model.ts";

const MARKS: Readonly<Record<string, CellMark>> = { err: "err", hong: "hong", hl: "hong" };

function parseTerm(raw: string): SynthTerm {
  const t = raw.trim();
  const m = /^\\([a-zA-Z]+)\{(.*)\}$/.exec(t);
  if (m !== null) {
    const mark = MARKS[m[1]!];
    if (mark === undefined) throw new LayoutSyntaxError(`不认识的命令 \\${m[1]}`);
    return { ...parseTerm(m[2]!), marks: [mark] };
  }
  if (!/^[+\-−]?\d+$/.test(t)) throw new LayoutSyntaxError(`综合除法的每格只能写一个整数：“${t}”`);
  return { text: t.replace(/^\+/, "").replace(/^-/, "−"), marks: [] };
}

function cellsOf(row: string): string[] {
  return row.split("&");
}

export function parseSynthDivLayout(source: string): SynthDivLayout {
  const rows = source
    .replace(/\\nobreakspace|~/g, " ")
    .split(/\\\\/)
    .map((r) => r.trim())
    .filter((r) => r !== "");
  if (rows.length !== 3) throw new LayoutSyntaxError("综合除法要写三行：系数、乘积、结果");
  const [first, second, third] = rows as [string, string, string];
  const bar = first.split("|");
  if (bar.length !== 2) throw new LayoutSyntaxError("第一行要写成“根 | 各项系数”");
  const root = parseTerm(bar[0]!);
  const top = cellsOf(bar[1]!).map(parseTerm);
  const middleCells = cellsOf(second);
  const bottom = cellsOf(third).map(parseTerm);
  if (middleCells.length !== top.length || bottom.length !== top.length) {
    throw new LayoutSyntaxError(`三行的格数要相同（第一行 ${top.length} 格）`);
  }
  if (middleCells[0]!.trim() !== "") throw new LayoutSyntaxError("第二行的第一格要空着");
  const middle = middleCells.map((c, i) => (i === 0 ? undefined : parseTerm(c)));
  return { root, top, middle, bottom, result: [] };
}
