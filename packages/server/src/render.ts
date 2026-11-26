/**
 * 公式 → 独立的 SVG / PNG 图片。
 * - 本库命令（竖式、短除法等）：core 画 SVG；递等式：core 转 TeX 再交 MathJax；普通公式：直接交 MathJax。
 * - 把根元素的尺寸换成像素、写上颜色，使 SVG 单独打开（<img>、文件）时也是对的。
 */
import { FONT_SIZE, translateFormula } from "@cn-math-notation/core";
import { texToSvg } from "./mathjax.ts";
import { LIMITS, type RenderParams } from "./params.ts";
import { missingPngChars, svgToPng } from "./png.ts";
import { RenderError } from "./render-error.ts";

export interface RenderedImage {
  readonly body: string | Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

/** MathJax 的 viewBox 以 1/1000 em 为单位。 */
const MATHJAX_UNITS_PER_EM = 1000;
const OPEN_TAG = /^<svg\b[^>]*>/;
const VIEWBOX = /\bviewBox="([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)"/;

interface SvgSource {
  readonly svg: string;
  /** viewBox 里多少单位是 1em。 */
  readonly unitsPerEm: number;
}

async function sourceSvg(tex: string): Promise<SvgSource> {
  const r = translateFormula(tex);
  switch (r.kind) {
    case "svg":
      return { svg: r.rendered.svg, unitsPerEm: FONT_SIZE };
    case "tex":
      return { svg: await texToSvg(r.tex), unitsPerEm: MATHJAX_UNITS_PER_EM };
    case "pass":
      return { svg: await texToSvg(tex), unitsPerEm: MATHJAX_UNITS_PER_EM };
    case "error":
      throw new RenderError(r.message);
  }
}

function round(n: number): string {
  return String(Math.ceil(n));
}

/** 去掉根元素原来的 width / height / style，换成像素尺寸与颜色。 */
function standalone(source: SvgSource, params: RenderParams): string {
  const open = OPEN_TAG.exec(source.svg)?.[0];
  const viewBox = open === undefined ? null : VIEWBOX.exec(open);
  if (open === undefined || viewBox === null) throw new Error("渲染结果缺少 <svg viewBox>");
  const width = (Number(viewBox[3]) / source.unitsPerEm) * params.size;
  const height = (Number(viewBox[4]) / source.unitsPerEm) * params.size;
  if (width > LIMITS.maxSidePx || height > LIMITS.maxSidePx) {
    throw new RenderError(`出图太大（${round(width)}×${round(height)} 像素，每边最多 ${LIMITS.maxSidePx}），请减小 size`);
  }
  const attrs = open
    .replace(/^<svg\b/, "")
    .replace(/>$/, "")
    .replace(/\s(width|height|style)="[^"]*"/g, "");
  const style = `color:${params.color};fill:currentColor;stroke:none`;
  const tag = `<svg width="${round(width)}" height="${round(height)}" style="${style}"${attrs}>`;
  return tag + source.svg.slice(open.length);
}

export async function renderImage(params: RenderParams): Promise<RenderedImage> {
  if (params.format === "png") {
    const missing = missingPngChars(params.tex);
    if (missing.length > 0) {
      throw new RenderError(`PNG 的内置字体里没有这些字：${missing.join("、")}；请改用 SVG`);
    }
  }
  const svg = standalone(await sourceSvg(params.tex), params);
  if (params.format === "png") {
    return { body: svgToPng(svg, params.background), contentType: "image/png" };
  }
  return { body: svg, contentType: "image/svg+xml; charset=utf-8" };
}
