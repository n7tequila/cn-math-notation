/**
 * 短除法语义式（按常见写法【推论】，设计草案 §10.5）：
 * - 一个数：分解质因数，从小到大用质数去除，除到商是质数为止。
 * - 两个数：用公有的质因数从小到大去除，除到两个商互质。
 * - 三个数（求最小公倍数）：能整除其中至少两个数的最小质数去除，除不尽的原样落下，除到两两互质。
 */
import { ExpressionError } from "../semantic/numbers.ts";
import { term, type ShortDivLayout, type ShortDivRow } from "./model.ts";
import type { ShortDivOptions } from "./options.ts";

/** 数太大时试除很慢，小学题目远小于这个上限。 */
const MAX_VALUE = 1_000_000;

function parseNumbers(source: string): number[] {
  const parts = source
    .replace(/\\nobreakspace|~/g, " ")
    .split(/[\s,，、]+/)
    .filter((p) => p !== "");
  if (parts.length === 0) throw new ExpressionError("短除法至少要写一个数");
  if (parts.length > 3) throw new ExpressionError("短除法最多写三个数");
  return parts.map((p) => {
    if (!/^\d+$/.test(p)) throw new ExpressionError(`"${p}" 不是正整数`);
    const n = Number(p);
    if (n < 2) throw new ExpressionError(`${p} 太小，不能列短除法`);
    if (n > MAX_VALUE) throw new ExpressionError(`${p} 太大（上限 ${MAX_VALUE}）`);
    return n;
  });
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let p = 2; p * p <= n; p += 1) if (n % p === 0) return false;
  return true;
}

function smallestPrimeFactor(n: number): number {
  for (let p = 2; p * p <= n; p += 1) if (n % p === 0) return p;
  return n;
}

/** 本步用的除数；undefined 表示该停了。 */
function nextDivisor(values: readonly number[]): number | undefined {
  if (values.length === 1) {
    const n = values[0]!;
    return isPrime(n) ? undefined : smallestPrimeFactor(n);
  }
  if (values.length === 2) {
    const g = gcd(values[0]!, values[1]!);
    return g === 1 ? undefined : smallestPrimeFactor(g);
  }
  // 三个数：能整除至少两个数的最小质数
  const candidates = [0, 1, 2].flatMap((i) => [0, 1, 2].filter((j) => j > i).map((j) => gcd(values[i]!, values[j]!)));
  const factors = candidates.filter((g) => g > 1).map(smallestPrimeFactor);
  return factors.length === 0 ? undefined : Math.min(...factors);
}

function divideAll(values: readonly number[], p: number): number[] {
  return values.map((v) => (v % p === 0 ? v / p : v));
}

function product(nums: readonly number[]): string {
  return nums.join("×");
}

function resultLines(start: readonly number[], divisors: readonly number[], last: readonly number[]): string[] {
  if (start.length === 1) return [`${start[0]} = ${product([...divisors, last[0]!])}`];
  const list = start.join(", ");
  const lcmFactors = [...divisors, ...last.filter((v) => v !== 1)];
  const lcm = lcmFactors.reduce((a, b) => a * b, 1);
  const lcmLine = `[${list}] = ${product(lcmFactors)} = ${lcm}`;
  if (start.length === 3) return [lcmLine];
  const g = divisors.reduce((a, b) => a * b, 1);
  const gcdLine = divisors.length === 1 ? `(${list}) = ${g}` : `(${list}) = ${product(divisors)} = ${g}`;
  return [gcdLine, lcmLine];
}

function noStepError(values: readonly number[]): ExpressionError {
  if (values.length === 1) return new ExpressionError(`${values[0]} 是质数，不用分解`);
  return new ExpressionError(`${values.join("、")} ${values.length === 2 ? "互质" : "两两互质"}，没有可以去除的公因数`);
}

export function buildShortDivFrom(source: string, opts: ShortDivOptions): ShortDivLayout {
  const start = parseNumbers(source);
  const rows: ShortDivRow[] = [];
  const divisors: number[] = [];
  let values = start;
  for (let p = nextDivisor(values); p !== undefined; p = nextDivisor(values)) {
    rows.push({ divisor: term(String(p)), values: values.map((v) => term(String(v))) });
    divisors.push(p);
    values = divideAll(values, p);
  }
  if (rows.length === 0) throw noStepError(start);
  rows.push({ values: values.map((v) => term(String(v))) });
  return { rows, result: opts.result ? resultLines(start, divisors, values) : [] };
}
