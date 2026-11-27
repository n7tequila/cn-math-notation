/**
 * 语义式算式解析：`74+88`、`403-167`、`43\times37`、`71\div4`、`24.5+16.3`，
 * 可带孩子的答案：`403-167=346`、`71÷4=17……3`（余数可写 `……`、`...` 或 `r`）。
 */
import type { Operator } from "../model.ts";

/** 算式里的四则运算符（≈ 只出现在近似值那一行）。 */
type ArithOperator = Exclude<Operator, "≈">;
import { ExpressionError, parseNum, type Num } from "./numbers.ts";

export interface Expression {
  readonly a: Num;
  readonly op: ArithOperator;
  readonly b: Num;
  /** 孩子写的答案（除法为商）。 */
  readonly answer?: Num;
  /** 孩子写的余数（仅除法）。 */
  readonly remainder?: Num;
}

const OPERATORS: readonly [RegExp, ArithOperator][] = [
  [/^(?:\+)/, "+"],
  [/^(?:-|−)/, "-"],
  [/^(?:\\times|×|\*|x|X)/, "×"],
  [/^(?:\\div|÷|\/)/, "÷"],
];

const NUMBER = /^\d+(?:\.\d+)?/;

/**
 * 每个数最多几位（整数与小数部分合计）【推论】：课本里的数远到不了这么长；不设上限时，
 * 嵌在公式里反复展开的超长乘法能让出图服务耗尽内存（2026-11-27 安全审查 H1）。
 */
export const MAX_DIGITS = 30;

function checkedNum(text: string): Num {
  const digits = text.replace(".", "").length;
  if (digits > MAX_DIGITS) throw new ExpressionError(`数太长了（${digits} 位），每个数最多 ${MAX_DIGITS} 位`);
  return parseNum(text);
}

export function parseExpression(source: string): Expression {
  // KaTeX 会把 ~ 等宏展开；语义式里不需要空白
  let rest = source.replace(/\\nobreakspace|~|\s+/g, "");
  if (rest === "") throw new ExpressionError("算式是空的");

  const take = (re: RegExp, what: string): string => {
    const m = re.exec(rest);
    if (m === null) throw new ExpressionError(`这里应该是${what}：“${rest || "（结尾）"}”`);
    rest = rest.slice(m[0].length);
    return m[0];
  };

  const a = checkedNum(take(NUMBER, "数字"));
  const opEntry = OPERATORS.find(([re]) => re.test(rest));
  if (opEntry === undefined) throw new ExpressionError(`这里应该是 + − × ÷ 之一：“${rest || "（结尾）"}”`);
  take(opEntry[0], "运算符");
  const b = checkedNum(take(NUMBER, "数字"));

  if (rest === "") return { a, op: opEntry[1], b };
  take(/^=/, "等号或结尾");
  const answer = checkedNum(take(NUMBER, "答案"));
  if (rest === "") return { a, op: opEntry[1], b, answer };
  if (opEntry[1] !== "÷") throw new ExpressionError("只有除法的答案可以写余数");
  take(/^(?:……|\.{2,}|…|r|R|\\ldots|\\cdots)/, "余数记号（……）");
  const remainder = checkedNum(take(NUMBER, "余数"));
  if (rest !== "") throw new ExpressionError(`多出了“${rest}”`);
  return { a, op: opEntry[1], b, answer, remainder };
}
