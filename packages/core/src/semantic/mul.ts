/**
 * 乘法竖式（整数与小数）。
 * - 一位数乘：简写（进位小字，坐在横线上）或分步式（每位分别乘再相加），由 mode 决定。
 * - 多位数乘：每个非 0 的乘数位一行部分积，按位左移；multiCarry 画各组进位，colorByDigit 按乘数位着色。
 *   乘数中间的 0 不写部分积。
 * - 因数末尾有 0（简便写法，样本“用一位数乘-末尾有0”）：0 前面的数对齐，末尾的 0 甩在外面不参与计算，
 *   积的末尾再添上同样多的 0。如 380×3：3 对齐 8，算 38×3=114，再添 0 得 1140。
 * - 小数（样本“小数乘法”，设计草案 §11.2）：两个因数末位对齐，按整数乘，部分积不点小数点；
 *   积的小数点不占列，写在空隙里（markPoint 标红）；积前面位数不够补 0（0.036，不加框）；
 *   积末尾的 0 划掉（strikeZero）。
 * - 小数因数末尾有 0（3.50×12，维护者 2026-11-27 定，无样本【推论】）：照整数的规则，0 甩在外面，
 *   按 35×12 算，积按原来的小数位数点小数点（42.00），末尾的 0 划掉。
 */
import type { Cell, Layout, Row } from "../model.ts";
import type { StyleOptions } from "../options.ts";
import { answerCells } from "./answer.ts";
import { toGapCells, numCells, trimNum } from "./gap-point.ts";
import { ExpressionError, carryCells, cellsOf, digitAt, fromScaled, parseNum, type Num } from "./numbers.ts";
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

/** 积：places 位小数（小数点写在空隙里）。 */
interface Product {
  readonly value: Num;
  readonly places: number;
}

function productCells(product: Product, style: StyleOptions): Cell[] {
  const { value, places } = product;
  if (places === 0) return cellsOf(value);
  const trailing = style.strikeZero ? value.frac.length - value.frac.replace(/0+$/, "").length : 0;
  return numCells(value, {
    point: style.markPoint ? "hong" : "dot",
    marksAt: (col) => (col < trailing ? ["hua"] : []),
  });
}

function finalRow(product: Product, e: Expression, style: StyleOptions): Row {
  if (e.answer === undefined) return { kind: "digits", cells: productCells(product, style) };
  if (product.places === 0) return { kind: "digits", cells: answerCells(e.answer, product.value) };
  // 84.0 与 84 是同一个数：按去掉末尾 0 的积比较，列仍按积的位数对齐
  const cells = answerCells(e.answer, trimNum(product.value));
  return { kind: "digits", cells: toGapCells(cells, product.places) };
}

/** 参与计算的部分：core × 10^zeros ÷ 10^places（整数去掉末尾 0；小数按整数算）。 */
interface Factor {
  readonly full: Num;
  readonly core: Num;
  readonly zeros: number;
  readonly places: number;
}

function factor(n: Num): Factor {
  if (n.frac !== "") {
    const digits = (n.int + n.frac).replace(/^0+(?=\d)/, "");
    if (/^0+$/.test(digits)) return { full: n, core: { int: "0", frac: "" }, zeros: 0, places: n.frac.length }; // 因数是 0
    // 只甩出小数部分末尾的 0；整数部分末尾的 0（30.0 的 3 后面那个）照常参与计算（审查 2026-11-27）
    const fracZeros = n.frac.length - n.frac.replace(/0+$/, "").length;
    const core = digits.slice(0, digits.length - fracZeros);
    return { full: n, core: { int: core, frac: "" }, zeros: fracZeros, places: n.frac.length };
  }
  const core = n.int.replace(/0+$/, "");
  if (core === "") return { full: n, core: n, zeros: 0, places: 0 }; // 因数是 0
  return { full: n, core: { int: core, frac: "" }, zeros: n.int.length - core.length, places: 0 };
}

/** 因数这一行：小数点写在空隙里，整数因数末尾的 0 甩在外面。 */
function factorCells(f: Factor, z: number): Cell[] {
  return numCells(f.full, { shift: z - f.zeros });
}

interface Plan {
  readonly a: Factor;
  readonly b: Factor;
  /** 两个因数末尾 0 的总数：0 前面的数以这一列为“个位”对齐。 */
  readonly z: number;
}

function heads(plan: Plan, multiplierCells: Cell[]): Row[] {
  return [
    { kind: "digits", cells: factorCells(plan.a, plan.z) },
    { kind: "digits", operator: "×", cells: multiplierCells },
  ];
}

function oneDigit(e: Expression, style: StyleOptions, product: Product, plan: Plan): Row[] {
  const d = Number(plan.b.core.int);
  const a = plan.a.core;
  const head = heads(plan, factorCells(plan.b, plan.z));
  if (style.mode === "compact") {
    const carries = style.carry ? carriesOf(a, d, plan.z) : new Map<number, number>();
    const carryRow: Row[] = carries.size > 0 ? [{ kind: "carry", cells: carryCells(carries) }] : [];
    return [...head, ...carryRow, { kind: "hline" }, finalRow(product, e, style)];
  }
  // 分步式：个位起，每一位乘出的积（带上该位的 0）各写一行，再相加
  const parts: Row[] = [];
  for (let i = 0; i < a.int.length; i += 1) {
    const ai = digitAt(a, i);
    if (ai === 0) continue;
    parts.push({ kind: "digits", cells: cellsOf(num(BigInt(ai * d) * 10n ** BigInt(i)), { shift: plan.z }) });
  }
  if (parts.length <= 1) return [...head, { kind: "hline" }, finalRow(product, e, style)];
  return [...head, { kind: "hline" }, ...parts, { kind: "hline" }, finalRow(product, e, style)];
}

function multiDigit(e: Expression, style: StyleOptions, product: Product, plan: Plan): Row[] {
  const a = BigInt(plan.a.core.int);
  const bDigits = [...plan.b.core.int].reverse().map(Number); // 个位在前
  const multiplierCells = factorCells(plan.b, plan.z).map((c) => {
    const j = c.col - plan.z; // 0 前面那部分的第 j 位
    return style.colorByDigit && j >= 0 ? { ...c, color: colorFor(j) } : c;
  });
  const rows = heads(plan, multiplierCells);
  const partials = bDigits.flatMap((d, j) => (d === 0 ? [] : [{ d, j }]));
  partials.forEach(({ d, j }, k) => {
    const color = style.colorByDigit ? colorFor(j) : undefined;
    const shift = j + plan.z;
    const carries = style.multiCarry && style.carry ? carriesOf(plan.a.core, d, shift) : new Map<number, number>();
    if (carries.size > 0) rows.push({ kind: "carry", cells: carryCells(carries, color) });
    if (k === 0) rows.push({ kind: "hline" });
    const value = num(a * BigInt(d));
    rows.push({ kind: "digits", cells: cellsOf(value, color === undefined ? { shift } : { shift, color }) });
  });
  const onlyRowIsProduct = partials.length === 1 && partials[0]!.j === 0 && plan.z === 0;
  if (onlyRowIsProduct) {
    rows[rows.length - 1] = finalRow(product, e, style);
    return rows;
  }
  return [...rows, { kind: "hline" }, finalRow(product, e, style)];
}

/** 不画过程：只写两个因数、横线和积（或孩子的答案）。 */
function withoutProcess(e: Expression, style: StyleOptions, product: Product, plan: Plan): Row[] {
  const head = heads(plan, factorCells(plan.b, plan.z));
  return [...head, { kind: "hline" }, finalRow(product, e, style)];
}

export function mulLayout(e: Expression, style: StyleOptions, process = true): Layout {
  const a = factor(e.a);
  const b = factor(e.b);
  const places = a.places + b.places;
  const scaledProduct = BigInt(e.a.int + e.a.frac) * BigInt(e.b.int + e.b.frac);
  const product: Product = { value: fromScaled(scaledProduct, places), places };
  const plan: Plan = { a, b, z: a.zeros + b.zeros };
  const rows = !process
    ? withoutProcess(e, style, product, plan)
    : b.core.int.length === 1
      ? oneDigit(e, style, product, plan)
      : multiDigit(e, style, product, plan);
  return { rows, hasDecimal: false };
}
