/**
 * 长除法竖式（整数被除数、整数除数）。小数除法属第二期。
 * 按课本写法：商从第一个够除的位开始写；每步写乘积、画横线、写余数并落下下一位；
 * 余数落位后仍不够除时商 0，不写这一步的乘积，直接再落一位；最后一行是余数（整除写 0）。
 */
import type { Cell, Layout, Row } from "../model.ts";
import { answerCells } from "./answer.ts";
import { ExpressionError, cellsOf, parseNum, type Num } from "./numbers.ts";
import type { Expression } from "./parse-expr.ts";

/** 把数写成一行，个位落在 col 列。 */
function rowAt(value: bigint, col: number): Row {
  return { kind: "digits", cells: cellsOf(parseNum(value.toString()), { shift: col }) };
}

interface Steps {
  readonly quotient: Map<number, number>;
  readonly rows: Row[];
  readonly remainder: bigint;
  readonly remainderCol: number;
}

function longDivision(dividend: string, divisor: bigint): Steps {
  const n = dividend.length;
  const colOf = (i: number): number => n - 1 - i;
  const digit = (i: number): bigint => BigInt(dividend[i]!);
  const quotient = new Map<number, number>();
  const rows: Row[] = [];

  let pos = 0;
  let cur = digit(0);
  while (cur < divisor && pos < n - 1) {
    pos += 1;
    cur = cur * 10n + digit(pos);
  }
  if (cur < divisor) {
    // 被除数比除数小：商 0，余数就是被除数
    quotient.set(0, 0);
    rows.push(rowAt(0n, 0), { kind: "hline" }, rowAt(cur, 0));
    return { quotient, rows, remainder: cur, remainderCol: 0 };
  }
  for (;;) {
    const q = cur / divisor;
    quotient.set(colOf(pos), Number(q));
    rows.push(rowAt(q * divisor, colOf(pos)), { kind: "hline" });
    const rem = cur - q * divisor;
    if (pos === n - 1) {
      rows.push(rowAt(rem, colOf(pos)));
      return { quotient, rows, remainder: rem, remainderCol: colOf(pos) };
    }
    pos += 1;
    let next = rem * 10n + digit(pos);
    while (next < divisor && pos < n - 1) {
      quotient.set(colOf(pos), 0);
      pos += 1;
      next = next * 10n + digit(pos);
    }
    if (next < divisor) {
      quotient.set(colOf(pos), 0);
      rows.push(rowAt(next, colOf(pos)));
      return { quotient, rows, remainder: next, remainderCol: colOf(pos) };
    }
    rows.push(rowAt(next, colOf(pos)));
    cur = next;
  }
}

function quotientCells(quotient: ReadonlyMap<number, number>): Cell[] {
  return [...quotient.entries()]
    .sort(([a], [b]) => b - a)
    .map(([col, d]) => ({ col, content: { kind: "digit", text: String(d) }, marks: [] }));
}

export function divLayout(e: Expression, process = true): Layout {
  if (e.a.frac !== "" || e.b.frac !== "") throw new ExpressionError("小数除法属第二期，暂请用直写布局 \\shushi*{…}");
  const divisor = BigInt(e.b.int);
  if (divisor === 0n) throw new ExpressionError("除数不能是 0");
  const steps = longDivision(e.a.int, divisor);
  const correctQuotient: Num = parseNum((BigInt(e.a.int) / divisor).toString());

  const quotientRow: Row =
    e.answer === undefined
      ? { kind: "digits", quotient: true, cells: quotientCells(steps.quotient) }
      : { kind: "digits", quotient: true, cells: answerCells(e.answer, correctQuotient) };
  let rows: Row[];
  if (process) {
    rows = [...steps.rows];
    if (e.remainder !== undefined) {
      rows[rows.length - 1] = {
        kind: "digits",
        cells: answerCells(e.remainder, parseNum(steps.remainder.toString()), steps.remainderCol),
      };
    }
  } else {
    // 不画过程：只留商、被除数；写了余数就在横线下写出余数（个位对齐）
    rows =
      e.remainder === undefined
        ? []
        : [{ kind: "hline" }, { kind: "digits", cells: answerCells(e.remainder, parseNum(steps.remainder.toString())) }];
  }
  return {
    rows: [quotientRow, { kind: "digits", divisor: e.b.int, cells: cellsOf(e.a) }, ...rows],
    hasDecimal: false,
  };
}
