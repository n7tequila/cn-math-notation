/**
 * 乘法竖式（整数）。小数乘法属第二期。
 * - 一位数乘：简写（进位小字，坐在横线上）或分步式（每位分别乘再相加），由 mode 决定。
 * - 多位数乘：每个非 0 的乘数位一行部分积，按位左移；multiCarry 画各组进位，colorByDigit 按乘数位着色。
 *   乘数中间的 0 不写部分积。
 * - 因数末尾有 0（简便写法，样本“用一位数乘-末尾有0”）：0 前面的数对齐，末尾的 0 甩在外面不参与计算，
 *   积的末尾再添上同样多的 0。如 380×3：3 对齐 8，算 38×3=114，再添 0 得 1140。
 */
import type { Cell, Layout, Row } from "../model.ts";
import type { StyleOptions } from "../options.ts";
import { answerCells } from "./answer.ts";
import { ExpressionError, carryCells, cellsOf, digitAt, parseNum, type Num } from "./numbers.ts";
import type { Expression } from "./parse-expr.ts";

/** 按乘数位着色的调色板：个位红、十位蓝、百位绿……（与样本“乘两位数有进位”一致）。 */
export const DIGIT_COLORS = ["#d4402b", "#2f6fd6", "#2e9e5b", "#9b51e0", "#c77700"] as const;

function colorFor(j: number): string {
  return DIGIT_COLORS[j % DIGIT_COLORS.length]!;
}

/** a × 一位数 d 的进位：记在进到的那一列（只记仍在 a 的数位范围内的进位，最高位的进位直接写进积）。 */
function carriesOf(a: Num, d: number, shift: number): Map<number, number> {
  const carries = new Map<number, number>();
  let carry = 0;
  for (let i = 0; i < a.int.length; i += 1) {
    const p = digitAt(a, i) * d + carry;
    carry = Math.floor(p / 10);
    if (carry > 0 && i + 1 < a.int.length) carries.set(i + 1 + shift, carry);
  }
  return carries;
}

function num(value: bigint): Num {
  return parseNum(value.toString());
}

function finalRow(product: Num, e: Expression, shift = 0): Row {
  const cells: Cell[] = e.answer === undefined ? cellsOf(product, { shift }) : answerCells(e.answer, product, shift);
  return { kind: "digits", cells };
}

/** 去掉末尾 0 之后参与计算的部分：core × 10^zeros。 */
interface Factor {
  readonly full: Num;
  readonly core: Num;
  readonly zeros: number;
}

function factor(n: Num): Factor {
  const core = n.int.replace(/0+$/, "");
  if (core === "") return { full: n, core: n, zeros: 0 }; // 因数是 0
  return { full: n, core: { int: core, frac: "" }, zeros: n.int.length - core.length };
}

interface Plan {
  readonly a: Factor;
  readonly b: Factor;
  /** 两个因数末尾 0 的总数：0 前面的数以这一列为“个位”对齐。 */
  readonly z: number;
}

function heads(plan: Plan, multiplierCells: Cell[]): Row[] {
  return [
    { kind: "digits", cells: cellsOf(plan.a.full, { shift: plan.z - plan.a.zeros }) },
    { kind: "digits", operator: "×", cells: multiplierCells },
  ];
}

function oneDigit(e: Expression, style: StyleOptions, product: Num, plan: Plan): Row[] {
  const d = Number(plan.b.core.int);
  const a = plan.a.core;
  const head = heads(plan, cellsOf(plan.b.full, { shift: plan.z - plan.b.zeros }));
  if (style.mode === "compact") {
    const carries = carriesOf(a, d, plan.z);
    const carryRow: Row[] = carries.size > 0 ? [{ kind: "carry", cells: carryCells(carries) }] : [];
    return [...head, ...carryRow, { kind: "hline" }, finalRow(product, e)];
  }
  // 分步式：个位起，每一位乘出的积（带上该位的 0）各写一行，再相加
  const parts: Row[] = [];
  for (let i = 0; i < a.int.length; i += 1) {
    const ai = digitAt(a, i);
    if (ai === 0) continue;
    parts.push({ kind: "digits", cells: cellsOf(num(BigInt(ai * d) * 10n ** BigInt(i)), { shift: plan.z }) });
  }
  if (parts.length <= 1) return [...head, { kind: "hline" }, finalRow(product, e)];
  return [...head, { kind: "hline" }, ...parts, { kind: "hline" }, finalRow(product, e)];
}

function multiDigit(e: Expression, style: StyleOptions, product: Num, plan: Plan): Row[] {
  const a = BigInt(plan.a.core.int);
  const bDigits = [...plan.b.core.int].reverse().map(Number); // 个位在前
  const bShift = plan.z - plan.b.zeros;
  const multiplierCells = cellsOf(plan.b.full, { shift: bShift }).map((c) => {
    const j = c.col - plan.z; // 0 前面那部分的第 j 位
    return style.colorByDigit && j >= 0 ? { ...c, color: colorFor(j) } : c;
  });
  const rows = heads(plan, multiplierCells);
  const partials = bDigits.flatMap((d, j) => (d === 0 ? [] : [{ d, j }]));
  partials.forEach(({ d, j }, k) => {
    const color = style.colorByDigit ? colorFor(j) : undefined;
    const shift = j + plan.z;
    const carries = style.multiCarry ? carriesOf(plan.a.core, d, shift) : new Map<number, number>();
    if (carries.size > 0) rows.push({ kind: "carry", cells: carryCells(carries, color) });
    if (k === 0) rows.push({ kind: "hline" });
    const value = num(a * BigInt(d));
    rows.push({ kind: "digits", cells: cellsOf(value, color === undefined ? { shift } : { shift, color }) });
  });
  const onlyRowIsProduct = partials.length === 1 && partials[0]!.j === 0 && plan.z === 0;
  if (onlyRowIsProduct) {
    if (e.answer !== undefined) rows[rows.length - 1] = finalRow(product, e);
    return rows;
  }
  return [...rows, { kind: "hline" }, finalRow(product, e)];
}

/** 不画过程：只写两个因数、横线和积（或孩子的答案）。 */
function withoutProcess(e: Expression, product: Num, plan: Plan): Row[] {
  const head = heads(plan, cellsOf(plan.b.full, { shift: plan.z - plan.b.zeros }));
  return [...head, { kind: "hline" }, finalRow(product, e)];
}

export function mulLayout(e: Expression, style: StyleOptions, process = true): Layout {
  if (e.a.frac !== "" || e.b.frac !== "") throw new ExpressionError("小数乘法属第二期，暂请用直写布局 \\shushi*{…}");
  const product = num(BigInt(e.a.int) * BigInt(e.b.int));
  const a = factor(e.a);
  const b = factor(e.b);
  const plan: Plan = { a, b, z: a.zeros + b.zeros };
  const rows = !process
    ? withoutProcess(e, product, plan)
    : b.core.int.length === 1
      ? oneDigit(e, style, product, plan)
      : multiDigit(e, style, product, plan);
  return { rows, hasDecimal: false };
}
