/**
 * 递等式的选项（维护者 2026-11-26）：`steps=N` 只写前 N 步（不算题目那行）；
 * 没写出来的步骤默认每步留一个空等号行（rest=blank），rest=cut 时直接截断。
 * `negative=false` 不允许负数（维护者 2026-11-27：默认允许），只对语义式起作用。
 */
import { OptionError } from "../options.ts";

export type DengshiRest = "blank" | "cut";

export interface DengshiOptions {
  /** 写出几步（不算题目那行）；不写则全部写出。 */
  readonly steps?: number;
  readonly rest: DengshiRest;
  /** 是否允许负数；只对语义式起作用（可省略，默认允许；0.9.0 新增）。 */
  readonly negative?: boolean;
}

export const DEFAULT_DENGSHI: DengshiOptions = { rest: "blank", negative: true };

function applyOption(opts: DengshiOptions, key: string, value: string): DengshiOptions {
  if (key === "steps") {
    if (!/^\d+$/.test(value)) throw new OptionError(`steps 要写不小于 0 的整数，收到 "${value}"`);
    return { ...opts, steps: Number(value) };
  }
  if (key === "rest") {
    if (value !== "blank" && value !== "cut") throw new OptionError(`rest 只能是 blank 或 cut，收到 "${value}"`);
    return { ...opts, rest: value };
  }
  if (key === "negative") {
    if (value !== "true" && value !== "false") throw new OptionError(`negative 只能是 true 或 false，收到 "${value}"`);
    return { ...opts, negative: value === "true" };
  }
  throw new OptionError(`未知选项 "${key}"`);
}

/** 解析方括号里的选项，如 `steps=2, rest=cut`。 */
export function parseDengshiOptions(source: string | undefined): DengshiOptions {
  if (source === undefined || source.trim() === "") return DEFAULT_DENGSHI;
  return source
    .split(",")
    .map((part) => part.trim())
    .filter((item) => item !== "")
    .reduce<DengshiOptions>((opts, item) => {
      const eq = item.indexOf("=");
      const key = (eq === -1 ? item : item.slice(0, eq)).trim();
      const value = eq === -1 ? "" : item.slice(eq + 1).trim();
      return applyOption(opts, key, value);
    }, DEFAULT_DENGSHI);
}
