/** 短除法选项：`result` 在下面写出结果算式（默认不写，维护者 2026-11-26 定）。 */
import { DEFAULT_RESULT_OPTION, parseResultOption, type ResultOption } from "../result-option.ts";

export type ShortDivOptions = ResultOption;
export const DEFAULT_SHORTDIV: ShortDivOptions = DEFAULT_RESULT_OPTION;
export const parseShortDivOptions = parseResultOption;
