/** 分解质因数树状图：语义式（split=prime|half）与直写。 */
import { OptionError } from "../options.ts";
import type { RenderOptions, RenderedSvg } from "../render-svg.ts";
import type { FactorTree } from "./model.ts";
import { parseFactorTreeOptions } from "./options.ts";
import { parseFactorTreeLayout } from "./parse.ts";
import { renderFactorTree } from "./render.ts";
import { buildFactorTreeFrom } from "./semantic.ts";

export type { FactorTree, FactorTreeNode } from "./model.ts";
export { parseFactorTreeOptions, DEFAULT_FACTORTREE, type FactorTreeOptions, type FactorSplit } from "./options.ts";
export { renderFactorTree, describeFactorTree } from "./render.ts";

/** 语义式：一个数 + 选项原文（如 `split=half, result`）→ 树。 */
export function buildFactorTree(source: string, options?: string): FactorTree {
  return buildFactorTreeFrom(source, parseFactorTreeOptions(options));
}

/** 直写：逐条写等式；可用 circle、result，不能用 split。 */
export function buildFactorTreeLayout(source: string, options?: string): FactorTree {
  const opts = parseFactorTreeOptions(options);
  if (opts.keys.includes("split")) throw new OptionError("直写的树状图按写的画，不支持 split");
  return parseFactorTreeLayout(source, opts.circle, opts.result);
}

export { parseFactorTreeLayout } from "./parse.ts";

export function renderShuzhuang(source: string, options?: string, render: RenderOptions = {}): RenderedSvg {
  return renderFactorTree(buildFactorTree(source, options), render);
}

export function renderShuzhuangLayout(source: string, options?: string, render: RenderOptions = {}): RenderedSvg {
  return renderFactorTree(buildFactorTreeLayout(source, options), render);
}
