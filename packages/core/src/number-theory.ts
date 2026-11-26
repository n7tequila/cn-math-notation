/** 短除法、树状图共用的整数小工具。 */
export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let p = 2; p * p <= n; p += 1) if (n % p === 0) return false;
  return true;
}

export function smallestPrimeFactor(n: number): number {
  for (let p = 2; p * p <= n; p += 1) if (n % p === 0) return p;
  return n;
}

/** 不超过 √n 的最大因数（n 为合数时 > 1）。 */
export function largestFactorBelowRoot(n: number): number {
  for (let d = Math.floor(Math.sqrt(n)); d > 1; d -= 1) if (n % d === 0) return d;
  return 1;
}
