/** 综合除法：语义式（除以 x − a）与直写。 */
import { OptionError } from "../options.ts";
import type { RenderOptions, RenderedSvg } from "../render-svg.ts";
import { parseSynthDivOptions } from "./options.ts";
import type { SynthDivLayout } from "./model.ts";
import { parseSynthDivLayout } from "./parse.ts";
import { renderSynthDiv } from "./render.ts";
import { buildSynthDivFrom } from "./semantic.ts";

export type { SynthDivLayout, SynthTerm } from "./model.ts";
export { parseSynthDivLayout } from "./parse.ts";
export { parseSynthDivOptions, DEFAULT_SYNTHDIV, type SynthDivOptions } from "./options.ts";
export { renderSynthDiv, describeSynthDiv } from "./render.ts";

/** 语义式：`(x^3-1)\div(x-1)` + 选项原文（如 `result`）→ 布局。 */
export function buildSynthDiv(source: string, options?: string): SynthDivLayout {
  return buildSynthDivFrom(source, parseSynthDivOptions(options));
}

export function renderZonghe(source: string, options?: string, render: RenderOptions = {}): RenderedSvg {
  return renderSynthDiv(buildSynthDiv(source, options), render);
}

/** 直写照写的画，不接受选项（商与余数写在外面）。 */
export function renderZongheLayout(source: string, options?: string, render: RenderOptions = {}): RenderedSvg {
  if (options !== undefined && options.trim() !== "") {
    parseSynthDivOptions(options);
    throw new OptionError("直写的综合除法不接受选项：商与余数请写在外面");
  }
  return renderSynthDiv(parseSynthDivLayout(source), render);
}
