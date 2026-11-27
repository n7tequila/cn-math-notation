/**
 * 递等式用的有符号十进制定点数：值 = n ÷ 10^scale。加减乘精确；除法只在能除尽时给出结果。
 */
import { ExpressionError } from "../semantic/numbers.ts";

export interface Dec {
  readonly n: bigint;
  readonly scale: number;
}

export function decFromText(text: string): Dec {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (m === null) throw new ExpressionError(`"${text}" 不是数字`);
  const frac = m[3] ?? "";
  const n = BigInt(m[2]! + frac);
  return { n: m[1] === "-" ? -n : n, scale: frac.length };
}

export function isNegative(d: Dec): boolean {
  return d.n < 0n;
}

/** 写成文字，去掉小数末尾的 0（算出来的数用）；负号用 "-"，与 TeX 的减号一致。 */
export function decText(d: Dec): string {
  const sign = d.n < 0n ? "-" : "";
  const digits = (d.n < 0n ? -d.n : d.n).toString().padStart(d.scale + 1, "0");
  const int = digits.slice(0, digits.length - d.scale);
  const frac = digits.slice(digits.length - d.scale).replace(/0+$/, "");
  return `${sign}${int}${frac === "" ? "" : `.${frac}`}`;
}

function gcd(a: bigint, b: bigint): bigint {
  let [x, y] = [a < 0n ? -a : a, b < 0n ? -b : b];
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** 约分后数一数分母里因子 p 的个数，并除掉。 */
function strip(value: bigint, p: bigint): [bigint, number] {
  let [v, count] = [value, 0];
  while (v % p === 0n) [v, count] = [v / p, count + 1];
  return [v, count];
}

/** x ÷ y（y ≠ 0）；约分后分母只含因子 2 和 5 才除得尽，否则返回 undefined。 */
export function decDiv(x: bigint, y: bigint): Dec | undefined {
  const g = gcd(x, y);
  const [num, den] = y < 0n ? [-x / g, -y / g] : [x / g, y / g];
  const [afterTwo, twos] = strip(den, 2n);
  const [rest, fives] = strip(afterTwo, 5n);
  if (rest !== 1n) return undefined;
  const scale = Math.max(twos, fives);
  return { n: (num * 10n ** BigInt(scale)) / den, scale };
}
