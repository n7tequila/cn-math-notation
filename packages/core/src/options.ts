/**
 * 写法样式选项。默认值即沪教版（维护者 2026-11-25 裁决，设计草案 §11.1）。
 */

export type CarryAt = "s" | "sw";
export type OperatorPlacement = "far" | "adjacent";
/** 一位数乘法：简写（进位小字）或分步式（每位分别乘再相加）。 */
export type MulMode = "compact" | "expanded";
/**
 * 语义式是否画计算过程（进位、退位点、补的 0、部分积、除法各步）。
 * auto：没写孩子答案时画；写了孩子答案时不画——程序按正确算法画出的过程会被误当成孩子写的。
 */
export type ProcessMode = "auto" | "show" | "hide";

export interface StyleOptions {
  /** 进位水平位置：s = 进到的那一列正下；sw = 产生进位那一位的左下。 */
  readonly carryAt: CarryAt;
  /** 数位虚线。 */
  readonly guides: boolean;
  /** 多位乘法是否画进位（语义式用；直写布局按写的为准）。 */
  readonly multiCarry: boolean;
  /** 小数位数不够时补 0（语义式用）。 */
  readonly padZero: boolean;
  /** 按乘数位着色（语义式用）。 */
  readonly colorByDigit: boolean;
  /** 运算符放最左（far）还是紧挨数字（adjacent）。 */
  readonly operatorPlacement: OperatorPlacement;
  /** 一位数乘法的写法（语义式用）。 */
  readonly mode: MulMode;
  /** 小数结果末尾的 0 划掉（语义式用，维护者 2026-11-25 定默认开）。 */
  readonly strikeZero: boolean;
  /** 是否画计算过程（语义式用）。 */
  readonly process: ProcessMode;
}

export const DEFAULT_STYLE: StyleOptions = {
  carryAt: "s",
  guides: true,
  multiCarry: false,
  padZero: true,
  colorByDigit: false,
  operatorPlacement: "far",
  mode: "compact",
  strikeZero: true,
  process: "auto",
};

const BOOLEAN_KEYS = ["guides", "multiCarry", "padZero", "colorByDigit", "strikeZero"] as const;

export class OptionError extends Error {
  override readonly name = "OptionError";
}

/**
 * 解析方括号里的选项，如 `carryAt=sw, guides=false, multiCarry`。
 * 只写键名表示 true。未知键或非法值抛 OptionError。
 */
export function parseOptions(source: string | undefined, base: StyleOptions = DEFAULT_STYLE): StyleOptions {
  if (source === undefined || source.trim() === "") return base;
  let result: StyleOptions = base;
  for (const part of source.split(",")) {
    const item = part.trim();
    if (item === "") continue;
    const eq = item.indexOf("=");
    const key = (eq === -1 ? item : item.slice(0, eq)).trim();
    const value = eq === -1 ? "true" : item.slice(eq + 1).trim();
    result = applyOption(result, key, value);
  }
  return result;
}

function applyOption(opts: StyleOptions, key: string, value: string): StyleOptions {
  if ((BOOLEAN_KEYS as readonly string[]).includes(key)) {
    if (value !== "true" && value !== "false") {
      throw new OptionError(`选项 ${key} 只能是 true 或 false，收到 "${value}"`);
    }
    return { ...opts, [key]: value === "true" };
  }
  if (key === "carryAt") {
    if (value !== "s" && value !== "sw") throw new OptionError(`carryAt 只能是 s 或 sw，收到 "${value}"`);
    return { ...opts, carryAt: value };
  }
  if (key === "operatorPlacement") {
    if (value !== "far" && value !== "adjacent") {
      throw new OptionError(`operatorPlacement 只能是 far 或 adjacent，收到 "${value}"`);
    }
    return { ...opts, operatorPlacement: value };
  }
  if (key === "mode") {
    if (value !== "compact" && value !== "expanded") {
      throw new OptionError(`mode 只能是 compact 或 expanded，收到 "${value}"`);
    }
    return { ...opts, mode: value };
  }
  if (key === "process") {
    if (value !== "auto" && value !== "show" && value !== "hide") {
      throw new OptionError(`process 只能是 auto、show 或 hide，收到 "${value}"`);
    }
    return { ...opts, process: value };
  }
  throw new OptionError(`未知选项 "${key}"`);
}
