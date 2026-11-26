/** 十字相乘：语义式（二次三项式整系数分解）与直写。 */
import { OptionError } from "../options.ts";
import type { RenderOptions, RenderedSvg } from "../render-svg.ts";
import type { CrossMulLayout } from "./model.ts";
import { parseCrossMulOptions } from "./options.ts";
import { parseCrossMulLayout } from "./parse.ts";
import { renderCrossMul } from "./render.ts";
import { buildCrossMulFrom } from "./semantic.ts";

export type { CrossMulLayout, CrossTerm } from "./model.ts";
export { parseCrossMulOptions, DEFAULT_CROSSMUL, type CrossMulOptions } from "./options.ts";
export { parseCrossMulLayout } from "./parse.ts";
export { renderCrossMul, describeCrossMul } from "./render.ts";

/** 语义式：`x^2+5x+6` + 选项原文（如 `result`、`check=false`）→ 布局。 */
export function buildCrossMul(source: string, options?: string): CrossMulLayout {
  return buildCrossMulFrom(source, parseCrossMulOptions(options));
}

export function renderShizi(source: string, options?: string, render: RenderOptions = {}): RenderedSvg {
  return renderCrossMul(buildCrossMul(source, options), render);
}

/** 直写：照写的画；验算行写不写由第三行决定，不接受选项。 */
export function renderShiziLayout(source: string, options?: string, render: RenderOptions = {}): RenderedSvg {
  if (options !== undefined && options.trim() !== "") {
    parseCrossMulOptions(options);
    throw new OptionError("直写的十字相乘不接受选项：验算行写在第三行，分解结果请写在外面");
  }
  return renderCrossMul(parseCrossMulLayout(source), render);
}
