/**
 * 树状图选项（维护者 2026-11-26）：split 拆法（prime 每步拆出最小质数 / half 尽量对半拆，只用于语义式）；
 * circle 质数叶子画圈（默认开）；result 在下面写结果算式（默认关）。
 */
import { OptionError } from "../options.ts";

export type FactorSplit = "prime" | "half";

export interface FactorTreeOptions {
  readonly split: FactorSplit;
  readonly circle: boolean;
  readonly result: boolean;
}

export const DEFAULT_FACTORTREE: FactorTreeOptions = { split: "prime", circle: true, result: false };

function applyOption(opts: FactorTreeOptions, key: string, value: string): FactorTreeOptions {
  if (key === "split") {
    if (value !== "prime" && value !== "half") throw new OptionError(`split 只能是 prime 或 half，收到 "${value}"`);
    return { ...opts, split: value };
  }
  if (key === "circle" || key === "result") {
    if (value !== "true" && value !== "false") throw new OptionError(`选项 ${key} 只能是 true 或 false，收到 "${value}"`);
    return { ...opts, [key]: value === "true" };
  }
  throw new OptionError(`未知选项 "${key}"`);
}

/** 解析方括号里的选项；返回值附带写过的键，便于直写拒绝 split。 */
export function parseFactorTreeOptions(source: string | undefined): FactorTreeOptions & { readonly keys: readonly string[] } {
  const items = (source ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((item) => item !== "");
  const keys: string[] = [];
  const opts = items.reduce<FactorTreeOptions>((acc, item) => {
    const eq = item.indexOf("=");
    const key = (eq === -1 ? item : item.slice(0, eq)).trim();
    keys.push(key);
    return applyOption(acc, key, eq === -1 ? "true" : item.slice(eq + 1).trim());
  }, DEFAULT_FACTORTREE);
  return { ...opts, keys };
}
