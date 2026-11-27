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
  /** 进位总开关（语义式用）：关掉后加法、乘法都不画进位；多位乘法另需 multiCarry。 */
  readonly carry: boolean;
  /** 积的小数点标红（语义式小数乘法用，默认关）。 */
  readonly markPoint: boolean;
  /** 除法添的 0 与对应的商位标红（语义式小数除法用，默认关）。 */
  readonly markAppended: boolean;
  /**
   * 整数除以整数写余数（17……3）。默认关：除不尽就添 0 除成小数（维护者 2026-11-26 定）。
   * 孩子的答案写了余数时自动按余数画。
   */
  readonly remainder: boolean;
  /** 小数点单独占一条窄列（加减法课本样本的写法）。默认关：小数点写在两个数字中间（维护者 2026-11-26 定）。 */
  readonly pointColumn: boolean;
  /** 多项式竖式用分离系数法：只写系数，缺项写 0（默认关）。 */
  readonly coefficients: boolean;
  /** 商是循环小数时除到第几位小数（语义式除法用；不写则除到循环节完整一遍且至少 3 位）。 */
  readonly places?: number;
  /** 求商的近似值：保留几位小数（语义式除法用；竖式多除一位，下面写“≈ 近似值”）。 */
  readonly round?: number;
  /** 循环小数的商用循环点代替省略号（语义式除法用，默认关；可省略，0.9.0 新增）。 */
  readonly repeatDot?: boolean;
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
  carry: true,
  markPoint: false,
  markAppended: false,
  remainder: false,
  pointColumn: false,
  coefficients: false,
  repeatDot: false,
};

/** places 上限【推论】：竖式再长就不适合手写了。 */
export const MAX_PLACES = 30;
/** round 上限【推论】。 */
export const MAX_ROUND = 10;

const BOOLEAN_KEYS = [
  "guides",
  "multiCarry",
  "padZero",
  "colorByDigit",
  "strikeZero",
  "carry",
  "markPoint",
  "markAppended",
  "remainder",
  "pointColumn",
  "coefficients",
  "repeatDot",
] as const;

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
  if (key === "places") return { ...opts, places: intOption(key, value, 1, MAX_PLACES) };
  if (key === "round") return { ...opts, round: intOption(key, value, 0, MAX_ROUND) };
  throw new OptionError(`未知选项 "${key}"`);
}

function intOption(key: string, value: string, min: number, max: number): number {
  const n = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!(n >= min && n <= max)) throw new OptionError(`${key} 要写 ${min}～${max} 的整数，收到 "${value}"`);
  return n;
}
