/** 只有一个 `result` 开关的选项解析（短除法用）：在下面写出结果，默认不写。 */
import { OptionError } from "./options.ts";

export interface ResultOption {
  readonly result: boolean;
}

export const DEFAULT_RESULT_OPTION: ResultOption = { result: false };

export function parseResultOption(source: string | undefined): ResultOption {
  return (source ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((item) => item !== "")
    .reduce<ResultOption>((opts, item) => {
      const eq = item.indexOf("=");
      const key = (eq === -1 ? item : item.slice(0, eq)).trim();
      const value = eq === -1 ? "true" : item.slice(eq + 1).trim();
      if (key !== "result") throw new OptionError(`未知选项 "${key}"`);
      if (value !== "true" && value !== "false") throw new OptionError(`选项 result 只能是 true 或 false，收到 "${value}"`);
      return { ...opts, result: value === "true" };
    }, DEFAULT_RESULT_OPTION);
}
