/** 十字相乘选项（维护者 2026-11-26）：check 写验算行（默认开）；result 写分解结果（默认关，只用于语义式）。 */
import { OptionError } from "../options.ts";

export interface CrossMulOptions {
  readonly check: boolean;
  readonly result: boolean;
}

export const DEFAULT_CROSSMUL: CrossMulOptions = { check: true, result: false };

export function parseCrossMulOptions(source: string | undefined): CrossMulOptions {
  return (source ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((item) => item !== "")
    .reduce<CrossMulOptions>((opts, item) => {
      const eq = item.indexOf("=");
      const key = (eq === -1 ? item : item.slice(0, eq)).trim();
      const value = eq === -1 ? "true" : item.slice(eq + 1).trim();
      if (key !== "check" && key !== "result") throw new OptionError(`未知选项 "${key}"`);
      if (value !== "true" && value !== "false") throw new OptionError(`选项 ${key} 只能是 true 或 false，收到 "${value}"`);
      return { ...opts, [key]: value === "true" };
    }, DEFAULT_CROSSMUL);
}
