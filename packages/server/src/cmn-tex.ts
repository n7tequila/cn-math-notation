/**
 * 本库命令注册成 MathJax 的 TeX 宏包 "cmn"，用于混写（维护者 2026-11-27）：
 * `74+88=162 \quad \shushi{74+88}` 里的竖式由 core 画好，作为图片字形嵌进公式，
 * 排完后 mathjax.ts 用 inlineEmbeddedSvg 换成内联 SVG。宏的实现在 core（mathjax-embed.ts）。
 */
import { Configuration } from "@mathjax/src/js/input/tex/Configuration.js";
import { CommandMap } from "@mathjax/src/js/input/tex/TokenMap.js";
import TexError from "@mathjax/src/js/input/tex/TexError.js";
import { createMathJaxMacros } from "@cn-math-notation/core";

export const CMN_PACKAGE = "cmn";

new CommandMap("cmn-macros", createMathJaxMacros(TexError) as never);
Configuration.create(CMN_PACKAGE, { handler: { macro: ["cmn-macros"] } });
