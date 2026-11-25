/**
 * 孩子写的答案：照孩子写的数画，与正确答案同一列数字不同的位标为错误（只标，不编造过程）。
 * - 漏写的位（如 236 写成 36）：在缺的那一列补一个空格子并标错，看得出漏了哪一位。
 * - 多写的位：落在正确答案范围外，标错。
 * - 兜底：数值不对却一位都没标出来时，整行标错，保证错答案一定看得出来。
 */
import type { Cell, CellMark } from "../model.ts";
import { cellsOf, digitAt, highestCol, scaled, type Num } from "./numbers.ts";

function sameValue(a: Num, b: Num): boolean {
  const places = Math.max(a.frac.length, b.frac.length);
  return scaled(a, places) === scaled(b, places);
}

function missingCell(col: number): Cell {
  return { col, content: { kind: "blank" }, marks: ["err"] };
}

function withErr(cell: Cell): Cell {
  const marks: CellMark[] = cell.marks.includes("err") ? [...cell.marks] : [...cell.marks, "err"];
  return { ...cell, marks };
}

export function answerCells(answer: Num, correct: Num, shift = 0): Cell[] {
  const wrongAt = (col: number): boolean => {
    const c = col - shift;
    if (c === -0.5) return false;
    if (c > highestCol(correct)) return true;
    if (c < 0 && -c > Math.max(correct.frac.length, answer.frac.length)) return true;
    return digitAt(answer, c) !== digitAt(correct, c);
  };
  const written = cellsOf(answer, { shift, marksAt: (col) => (wrongAt(col) ? ["err"] : []) });

  const missingHigh: Cell[] = [];
  for (let c = highestCol(correct); c > highestCol(answer); c -= 1) missingHigh.push(missingCell(c + shift));
  const missingLow: Cell[] = [];
  for (let j = answer.frac.length; j < correct.frac.length; j += 1) missingLow.push(missingCell(-(j + 1) + shift));

  const cells = [...missingHigh, ...written, ...missingLow];
  if (!sameValue(answer, correct) && !cells.some((c) => c.marks.includes("err"))) return cells.map(withErr);
  return cells;
}
