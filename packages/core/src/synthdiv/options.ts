/**
 * 综合除法选项（维护者 2026-11-26）：result 写商与余数（默认关）；problem 在上方写原题（默认开）。只用于语义式。
 */
import { OptionError } from "../options.ts";

export interface SynthDivOptions {
  readonly result: boolean;
  readonly problem: boolean;
}

export const DEFAULT_SYNTHDIV: SynthDivOptions = { result: false, problem: true };

export function parseSynthDivOptions(source: string | undefined): SynthDivOptions {
  return (source ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((item) => item !== "")
    .reduce<SynthDivOptions>((opts, item) => {
      const eq = item.indexOf("=");
      const key = (eq === -1 ? item : item.slice(0, eq)).trim();
      const value = eq === -1 ? "true" : item.slice(eq + 1).trim();
      if (key !== "result" && key !== "problem") throw new OptionError(`未知选项 "${key}"`);
      if (value !== "true" && value !== "false") throw new OptionError(`选项 ${key} 只能是 true 或 false，收到 "${value}"`);
      return { ...opts, [key]: value === "true" };
    }, DEFAULT_SYNTHDIV);
}
