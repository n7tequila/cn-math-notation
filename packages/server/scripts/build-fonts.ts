/**
 * 生成 PNG 出图用的内置字体（只在 core 新增了中文字或符号时需要重跑）。
 *
 *   bun run fonts <源字体目录>
 *
 * 源字体目录里要有（均为 SIL OFL 1.1）：
 * - NotoSans[wdth,wght].ttf、NotoSans-Italic[wdth,wght].ttf：github.com/google/fonts（ofl/notosans）
 * - NotoSansSC-Regular.otf：github.com/notofonts/noto-cjk（Sans/SubsetOTF/SC）
 * - STIXTwoText[wght].ttf、STIXTwoText-Italic[wght].ttf：github.com/google/fonts（ofl/stixtwotext）
 *
 * 分工：无衬线是 Noto Sans 的西文字形 + Noto Sans SC 的中文字形，合成“CMN Sans”的常规体与斜体（原因见 merge-fonts.ts）；
 * STIX Two Text 是衬线体。
 * 常规体的中文裁剪到“core 源码里出现过的字 + GB2312 一级常用字 + 全角标点”（普通公式里 \text{米} 等要用）；
 * 斜体只用于 core 画的变量，中文只带 core 用字。可变字体固定成常规字重。
 * 另写出 charset.txt（常规体能画的非 ASCII 字符），出图服务据此拒绝 PNG 画不出的字。
 */
import { copyFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import subsetFont from "subset-font";
import opentype, { type Font } from "opentype.js";
import { mergeLatinWithCjk } from "./merge-fonts.ts";

const sourceDir = process.argv[2];
if (sourceDir === undefined) throw new Error("用法：bun run fonts <源字体目录>");

const ROOT = join(import.meta.dir, "..");
const FONTS = join(ROOT, "fonts");
const CORE_SRC = join(ROOT, "..", "core", "src");
const REGULAR = { wght: 400, wdth: 100 } as const;
const GB2312_LEVEL1_LAST_ROW = 0xd7;
const GB2312_LEVEL1_LAST_LO = 0xf9;
/** 合成字体的族名：和原字体不同名，避免与系统里装的 Noto Sans SC 混淆（OFL 也要求改过的字体不再用保留名）。 */
const SANS_FAMILY = "CMN Sans";

async function coreChars(): Promise<string> {
  const chars = new Set<string>();
  for (let code = 0x20; code < 0x7f; code++) chars.add(String.fromCharCode(code));
  const entries = await readdir(CORE_SRC, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".ts")) continue;
    for (const ch of await Bun.file(join(e.parentPath, e.name)).text()) if (ch.codePointAt(0)! > 0x7f) chars.add(ch);
  }
  return [...chars].join("");
}

async function subset(source: string, text: string, axes?: typeof REGULAR): Promise<Uint8Array> {
  const font = Buffer.from(await Bun.file(join(sourceDir!, source)).arrayBuffer());
  const out = await subsetFont(font, text, { targetFormat: "sfnt", ...(axes === undefined ? {} : { variationAxes: axes }) });
  return new Uint8Array(out);
}

async function write(target: string, bytes: Uint8Array): Promise<void> {
  await Bun.write(join(FONTS, target), bytes);
  console.log(`${target}：${(bytes.length / 1024).toFixed(0)} KB`);
}

function parse(bytes: Uint8Array): Font {
  return opentype.parse(bytes.slice().buffer);
}

/** GB2312 第 hi 区的字（第 0xD7 区只到 0xF9，后面是 GBK 扩展）。 */
function gb2312Rows(from: number, to: number): string {
  const decoder = new TextDecoder("gb2312");
  let out = "";
  for (let hi = from; hi <= to; hi++) {
    const lastLo = hi === GB2312_LEVEL1_LAST_ROW ? GB2312_LEVEL1_LAST_LO : 0xfe;
    for (let lo = 0xa1; lo <= lastLo; lo++) {
      const ch = decoder.decode(new Uint8Array([hi, lo]));
      if (ch.length === 1 && ch !== "\ufffd") out += ch;
    }
  }
  return out;
}

const text = await coreChars();
const commonText = [...new Set(text + gb2312Rows(0xa1, 0xa3) + gb2312Rows(0xb0, GB2312_LEVEL1_LAST_ROW))].join("");
const cjkCommon = parse(await subset("NotoSansSC-Regular.otf", commonText));
const cjkCore = parse(await subset("NotoSansSC-Regular.otf", text));
const latin = parse(await subset("NotoSans[wdth,wght].ttf", text, REGULAR));
const latinItalic = parse(await subset("NotoSans-Italic[wdth,wght].ttf", text, REGULAR));
const regular = mergeLatinWithCjk(latin, cjkCommon, SANS_FAMILY, "Regular");
await write("CMNSans-Regular.otf", regular);
await write("CMNSans-Italic.otf", mergeLatinWithCjk(latinItalic, cjkCore, SANS_FAMILY, "Italic"));
const regularFont = parse(regular);
const covered = [...commonText].filter((ch) => ch.codePointAt(0)! > 0x7f && regularFont.charToGlyph(ch).index > 0);
await Bun.write(join(FONTS, "charset.txt"), covered.join(""));
console.log(`charset.txt：${covered.length} 个非 ASCII 字符`);
await copyFile(join(sourceDir, "STIXTwoText[wght].ttf"), join(FONTS, "STIXTwoText.ttf"));
await copyFile(join(sourceDir, "STIXTwoText-Italic[wght].ttf"), join(FONTS, "STIXTwoText-Italic.ttf"));
console.log(`core 用字 ${[...text].length} 个，常规体共 ${[...commonText].length} 个`);
