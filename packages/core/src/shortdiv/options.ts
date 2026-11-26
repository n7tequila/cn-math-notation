/** 短除法选项：`result` 在下面写出结果算式（默认不写，维护者 2026-11-26 定）。 */
import { OptionError } from "../options.ts";

export interface ShortDivOptions {
  readonly result: boolean;
}

export const DEFAULT_SHORTDIV: ShortDivOptions = { result: false };

export function parseShortDivOptions(source: string | undefined): ShortDivOptions {
  if (source === undefined || source.trim() === "") return DEFAULT_SHORTDIV;
  return source
    .split(",")
    .map((part) => part.trim())
    .filter((item) => item !== "")
    .reduce<ShortDivOptions>((opts, item) => {
      const eq = item.indexOf("=");
      const key = (eq === -1 ? item : item.slice(0, eq)).trim();
      const value = eq === -1 ? "true" : item.slice(eq + 1).trim();
      if (key !== "result") throw new OptionError(`未知选项 "${key}"`);
      if (value !== "true" && value !== "false") throw new OptionError(`选项 result 只能是 true 或 false，收到 "${value}"`);
      return { ...opts, result: value === "true" };
    }, DEFAULT_SHORTDIV);
}
