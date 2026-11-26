import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import opentype, { type Font } from "opentype.js";
import { mergeLatinWithCjk } from "../scripts/merge-fonts.ts";

const FONTS = join(import.meta.dir, "..", "fonts");

async function load(name: string): Promise<Font> {
  return opentype.parse(await Bun.file(join(FONTS, name)).arrayBuffer());
}

function reparse(bytes: Uint8Array): Font {
  return opentype.parse(bytes.slice().buffer);
}

describe("mergeLatinWithCjk：西文 + 中文合成一个字体", () => {
  test("合成斜体：族名、斜体角度、西文与中文字形都在", async () => {
    // Arrange：用已生成的字体再合并一次（斜体当西文来源，常规体当中文来源）
    const italic = await load("CMNSans-Italic.otf");
    const regular = await load("CMNSans-Regular.otf");

    // Act
    const merged = reparse(mergeLatinWithCjk(italic, regular, "Test Sans", "Italic"));

    // Assert
    expect(merged.names.windows?.fontFamily?.["en"] ?? merged.names.unicode?.fontFamily?.["en"]).toBe("Test Sans");
    expect(merged.tables.post?.italicAngle).toBeLessThan(0);
    expect(merged.charToGlyph("x").index).toBeGreaterThan(0);
    expect(merged.charToGlyph("商").index).toBeGreaterThan(0);
  });

  test("同一码位取西文字体的字形", async () => {
    const italic = await load("CMNSans-Italic.otf");
    const regular = await load("CMNSans-Regular.otf");
    const merged = reparse(mergeLatinWithCjk(italic, regular, "Test Sans", "Italic"));
    expect(merged.charToGlyph("x").advanceWidth).toBe(italic.charToGlyph("x").advanceWidth);
    expect(merged.charToGlyph("×").advanceWidth).toBe(italic.charToGlyph("×").advanceWidth);
  });

  test("西文字体的斜体与否和要合成的样式不符时报错", async () => {
    const italic = await load("CMNSans-Italic.otf");
    const regular = await load("CMNSans-Regular.otf");
    expect(() => mergeLatinWithCjk(regular, regular, "Test Sans", "Italic")).toThrow();
    expect(() => mergeLatinWithCjk(italic, regular, "Test Sans", "Regular")).toThrow();
  });
});
