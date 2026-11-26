/**
 * 十字相乘直写：`x & +2 \\ x & +3`，可选第三行验算 `3x+2x=5x`。
 * 四个角只能写简单的单项式（数字、字母、^次数、正负号），因为整张图画成 SVG【推论】；
 * 可用 `\err{…}`、`\hong{…}` 包住一个角或验算行。
 */
import type { CellMark } from "../model.ts";
import { prettyTerm } from "../math-text.ts";
import { LayoutSyntaxError } from "../parse-layout.ts";
import type { CrossMulLayout, CrossTerm } from "./model.ts";

const MARKS: Readonly<Record<string, CellMark>> = { err: "err", hong: "hong", hl: "hong" };

function parseTerm(raw: string, allowEquation: boolean): CrossTerm {
  const t = raw.trim();
  const wrapped = /^\\([a-zA-Z]+)\{(.*)\}$/.exec(t);
  const marks: CellMark[] = [];
  let body = t;
  if (wrapped !== null) {
    const mark = MARKS[wrapped[1]!];
    if (mark === undefined) throw new LayoutSyntaxError(`不认识的命令 \\${wrapped[1]}`);
    marks.push(mark);
    body = wrapped[2]!.trim();
  }
  const allowed = allowEquation ? /^[0-9a-zA-Z+\-−=^{}\s]+$/ : /^[0-9a-zA-Z+\-−^{}\s]+$/;
  if (body === "" || !allowed.test(body)) {
    throw new LayoutSyntaxError(`十字相乘的每个角只能写简单的单项式（如 2x、-3、+2y）：“${t}”`);
  }
  return { text: prettyTerm(body), marks };
}

export function parseCrossMulLayout(source: string): CrossMulLayout {
  const rows = source
    .replace(/\\nobreakspace|~/g, " ")
    .split(/\\\\/)
    .map((r) => r.trim())
    .filter((r) => r !== "");
  if (rows.length < 2 || rows.length > 3) {
    throw new LayoutSyntaxError("十字相乘要写两行（每行“左 & 右”），可再加一行验算");
  }
  const corners = rows.slice(0, 2).map((row) => {
    const cells = row.split("&");
    if (cells.length !== 2) throw new LayoutSyntaxError(`每行要用 & 分成左右两项：“${row}”`);
    return [parseTerm(cells[0]!, false), parseTerm(cells[1]!, false)] as const;
  });
  const [top, bottom] = corners as [readonly [CrossTerm, CrossTerm], readonly [CrossTerm, CrossTerm]];
  const check = rows[2] === undefined ? undefined : parseTerm(rows[2], true);
  return {
    left: [top[0], bottom[0]],
    right: [top[1], bottom[1]],
    ...(check === undefined ? {} : { check }),
    result: [],
  };
}
