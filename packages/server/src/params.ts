/** 出图参数：来自 GET 查询串或 POST 的 JSON，统一在这里校验。 */

export type ImageFormat = "svg" | "png";

export interface RenderParams {
  readonly tex: string;
  readonly format: ImageFormat;
  /** 每 em 多少像素（竖式一格约 1em）。 */
  readonly size: number;
  readonly color: string;
  /** PNG 底色；transparent 表示透明。SVG 不画底色。 */
  readonly background: string;
}

export const LIMITS = {
  maxTexLength: 2000,
  minSize: 8,
  maxSize: 128,
  /** 出图每边最多多少像素。 */
  maxSidePx: 4096,
  /** POST 请求体最大字节数。 */
  maxBodyBytes: 64 * 1024,
} as const;

export const DEFAULT_PARAMS: Omit<RenderParams, "tex"> = {
  format: "svg",
  size: 24,
  color: "#000",
  background: "transparent",
};

export class ParamError extends Error {
  override readonly name = "ParamError";
}

/** 只放行十六进制色值和英文颜色名：颜色会写进 SVG 属性，不能带引号、括号等。 */
const COLOR_PATTERN = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,30})$/;
const FORMATS: readonly ImageFormat[] = ["svg", "png"];

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ParamError(`${key} 应该是字符串`);
  return value;
}

function parseTex(raw: Record<string, unknown>): string {
  const tex = optionalString(raw, "tex");
  if (tex === undefined || tex.trim() === "") throw new ParamError("缺少 tex（要渲染的公式）");
  if (tex.length > LIMITS.maxTexLength) throw new ParamError(`tex 太长，最多 ${LIMITS.maxTexLength} 个字符`);
  return tex;
}

function parseSize(value: unknown): number {
  if (value === undefined || value === null || value === "") return DEFAULT_PARAMS.size;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(n) || n < LIMITS.minSize || n > LIMITS.maxSize) {
    throw new ParamError(`size 应该是 ${LIMITS.minSize}～${LIMITS.maxSize} 之间的整数`);
  }
  return n;
}

function parseColor(raw: Record<string, unknown>, key: string, fallback: string): string {
  const value = optionalString(raw, key) ?? fallback;
  if (!COLOR_PATTERN.test(value)) throw new ParamError(`${key} 只能写十六进制色值（如 #336699）或英文颜色名（如 red）`);
  return value;
}

function parseFormat(raw: Record<string, unknown>, fallback: ImageFormat): ImageFormat {
  const value = optionalString(raw, "format") ?? fallback;
  const format = FORMATS.find((f) => f === value);
  if (format === undefined) throw new ParamError("format 只能是 svg 或 png");
  return format;
}

/** format 由路径决定时（/render.svg、/render.png）作为 fallback 传入。 */
export function parseParams(raw: Record<string, unknown>, format: ImageFormat = DEFAULT_PARAMS.format): RenderParams {
  return {
    tex: parseTex(raw),
    format: parseFormat(raw, format),
    size: parseSize(raw["size"]),
    color: parseColor(raw, "color", DEFAULT_PARAMS.color),
    background: parseColor(raw, "background", DEFAULT_PARAMS.background),
  };
}
