/** opentype.js 2.0 没有自带类型，社区类型对应 1.3；这里只声明本仓用到的部分。 */
declare module "opentype.js" {
  interface PathLike {
    readonly commands: readonly unknown[];
  }

  export class Glyph {
    constructor(options: {
      name: string;
      unicode?: number;
      unicodes: number[];
      advanceWidth: number;
      path: PathLike;
    });
    readonly index: number;
    readonly name?: string;
    readonly unicode?: number;
    readonly unicodes?: number[];
    readonly advanceWidth?: number;
    readonly path: PathLike;
  }

  interface GlyphSet {
    readonly length: number;
    get(index: number): Glyph;
  }

  interface LocalizedNames {
    readonly fontFamily?: Readonly<Record<string, string>>;
  }

  export class Font {
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      italicAngle?: number;
      weightClass?: number;
      glyphs: Glyph[];
    });
    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    readonly glyphs: GlyphSet;
    readonly names: { readonly windows?: LocalizedNames; readonly unicode?: LocalizedNames };
    readonly tables: { readonly post?: { readonly italicAngle: number } };
    charToGlyph(char: string): Glyph;
    toArrayBuffer(): ArrayBuffer;
  }

  function parse(buffer: ArrayBuffer): Font;
  const opentype: { parse: typeof parse; Font: typeof Font; Glyph: typeof Glyph };
  export default opentype;
}
