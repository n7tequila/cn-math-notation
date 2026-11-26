/**
 * 把西文字体与中文字体合成一个字体（常规体、斜体各合一次，族名相同）。
 *
 * 原因（resvg 2.6 实测）：
 * - 一行文字里只要有斜体字体缺的字（如“商”），resvg 就整行改用能覆盖全部字的字体，斜体 tspan 也变成直立；
 *   斜体字体里也带上中文字形，就不会被换掉。
 * - 中文字体自带的 × 等符号是全角宽度，西文字形取自西文字体才和浏览器里的样子接近。
 * 西文字形优先，西文字体里没有的码位再从中文字体补；字距等排版表不保留（只用于少量标注文字）。
 */
import opentype, { type Font, type Glyph } from "opentype.js";

function codepoints(glyph: Glyph): number[] {
  if (glyph.unicodes !== undefined && glyph.unicodes.length > 0) return glyph.unicodes;
  return glyph.unicode === undefined ? [] : [glyph.unicode];
}

function copyGlyph(glyph: Glyph, index: number, unicodes: number[]): Glyph {
  return new opentype.Glyph({
    name: glyph.name ?? `glyph${index}`,
    ...(unicodes[0] === undefined ? {} : { unicode: unicodes[0] }),
    unicodes,
    advanceWidth: glyph.advanceWidth ?? 0,
    path: glyph.path,
  });
}

export type MergedStyle = "Regular" | "Italic";

/** 返回合成后的 OTF 字节。两个字体的 unitsPerEm 必须相同；style 为 Italic 时西文字体必须是斜体。 */
export function mergeLatinWithCjk(latin: Font, cjk: Font, family: string, style: MergedStyle): Uint8Array {
  if (latin.unitsPerEm !== cjk.unitsPerEm) {
    throw new Error(`unitsPerEm 不同（${latin.unitsPerEm} / ${cjk.unitsPerEm}），不能直接合并`);
  }
  const italicAngle = latin.tables.post?.italicAngle ?? 0;
  if ((style === "Italic") !== italicAngle < 0) {
    throw new Error(`西文字体的 post.italicAngle 是 ${italicAngle}，和要合成的 ${style} 不符`);
  }
  const glyphs: Glyph[] = [copyGlyph(latin.glyphs.get(0), 0, [])]; // .notdef
  const covered = new Set<number>();
  for (const font of [latin, cjk]) {
    for (let i = 1; i < font.glyphs.length; i++) {
      const glyph = font.glyphs.get(i);
      const unicodes = codepoints(glyph).filter((c) => !covered.has(c));
      if (unicodes.length === 0) continue;
      unicodes.forEach((c) => covered.add(c));
      glyphs.push(copyGlyph(glyph, glyphs.length, unicodes));
    }
  }
  const merged = new opentype.Font({
    familyName: family,
    styleName: style,
    unitsPerEm: latin.unitsPerEm,
    ascender: latin.ascender,
    descender: latin.descender,
    italicAngle,
    weightClass: 400,
    glyphs,
  });
  return new Uint8Array(merged.toArrayBuffer());
}
