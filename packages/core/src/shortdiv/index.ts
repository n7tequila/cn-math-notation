/** 短除法：语义式（分解质因数、两个数的公因数与公倍数、三个数的公倍数）与直写。 */
import { OptionError } from "../options.ts";
import type { RenderOptions, RenderedSvg } from "../render-svg.ts";
import type { ShortDivLayout } from "./model.ts";
import { parseShortDivOptions } from "./options.ts";
import { parseShortDivLayout } from "./parse.ts";
import { renderShortDiv } from "./render.ts";
import { buildShortDivFrom } from "./semantic.ts";

export type { ShortDivLayout, ShortDivRow, ShortDivTerm } from "./model.ts";
export { parseShortDivOptions, DEFAULT_SHORTDIV, type ShortDivOptions } from "./options.ts";
export { parseShortDivLayout } from "./parse.ts";
export { renderShortDiv, describeShortDiv } from "./render.ts";

/** 语义式：`36`、`36, 48`、`4, 6, 9` + 选项原文（如 `result`）→ 布局。 */
export function buildShortDiv(source: string, options?: string): ShortDivLayout {
  return buildShortDivFrom(source, parseShortDivOptions(options));
}

export function renderDuanchu(source: string, options?: string, render: RenderOptions = {}): RenderedSvg {
  return renderShortDiv(buildShortDiv(source, options), render);
}

/** 直写没有选项（结果算式由语义式算出）；写了选项报错。 */
export function renderDuanchuLayout(source: string, options?: string, render: RenderOptions = {}): RenderedSvg {
  if (parseShortDivOptions(options).result) {
    throw new OptionError("直写的短除法不支持 result，结果算式请自己写在外面");
  }
  return renderShortDiv(parseShortDivLayout(source), render);
}
