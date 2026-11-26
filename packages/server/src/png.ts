/**
 * SVG → PNG（resvg）。只用仓库内置字体、不读系统字体，任何机器出图都一样：
 * 无衬线用 Noto Sans 西文 + Noto Sans SC 中文合成的“CMN Sans”（常规体、斜体），衬线用 STIX Two Text（均为 OFL 字体）。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const FONT_DIR = join(import.meta.dir, "..", "fonts");
const FONT_FILES = [
  "CMNSans-Regular.otf",
  "CMNSans-Italic.otf",
  "STIXTwoText.ttf",
  "STIXTwoText-Italic.ttf",
].map((f) => join(FONT_DIR, f));
/** Noto Sans 西文 + Noto Sans SC 中文合成的字体，常规体与斜体（见 scripts/merge-fonts.ts）。 */
const SANS = "CMN Sans";
const SERIF = "STIX Two Text";

/** 内置字体能画的非 ASCII 字符（scripts/build-fonts.ts 生成）。 */
const CHARSET = new Set(readFileSync(join(FONT_DIR, "charset.txt"), "utf8"));
/** 中日韩文字与全角符号：MathJax 没有这些字形，只能靠内置字体画。 */
const CJK = /[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/gu;

/** 公式里内置字体画不出的字（去重，按出现顺序）。 */
export function missingPngChars(tex: string): string[] {
  return [...new Set(tex.match(CJK) ?? [])].filter((ch) => !CHARSET.has(ch));
}

export function svgToPng(svg: string, background: string): Uint8Array<ArrayBuffer> {
  const resvg = new Resvg(svg, {
    ...(background === "transparent" ? {} : { background }),
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: SANS,
      sansSerifFamily: SANS,
      serifFamily: SERIF,
    },
  });
  return new Uint8Array(resvg.render().asPng());
}
