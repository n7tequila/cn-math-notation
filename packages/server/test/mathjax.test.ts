import { describe, expect, test } from "bun:test";
import { texToSvg } from "../src/mathjax.ts";
import { RenderError } from "../src/render-error.ts";

describe("texToSvg：宏包与 Typora 的 MathJax 一致", () => {
  const supported: Array<[string, string]> = [
    ["boldsymbol", String.raw`\boldsymbol{x}`],
    ["cancel", String.raw`\cancel{5}`],
    ["mhchem", String.raw`\ce{2H2 + O2 -> 2H2O}`],
    ["physics", String.raw`\dv{f}{x}`],
    ["amscd", String.raw`\begin{CD} A @>>> B \end{CD}`],
    ["color", String.raw`\color{red}{x}+\textcolor{blue}{y}`],
    ["mathtools", String.raw`\coloneqq`],
    ["braket", String.raw`\braket{\phi|\psi}`],
    ["cases", String.raw`\begin{numcases}{f(x)=} 1 & x>0 \end{numcases}`],
    ["enclose", String.raw`\enclose{circle}{3}`],
    ["bbox", String.raw`\bbox[yellow]{x}`],
    ["upgreek", String.raw`\uppi`],
    ["gensymb", String.raw`30\degree`],
    ["units", String.raw`\units{3}{m}`],
    ["textmacros", String.raw`\text{a \textbf{b}}`],
    ["newcommand", String.raw`\newcommand{\half}{\frac12}\half`],
    ["extpfeil", String.raw`\xtwoheadrightarrow{a}`],
    ["dsfont", String.raw`\mathds{R}`],
  ];
  for (const [pkg, tex] of supported) {
    test(`${pkg}：${tex}`, async () => {
      expect((await texToSvg(tex)).startsWith("<svg")).toBe(true);
    });
  }

  test("可以往 SVG 里塞链接、样式或 HTML 的命令不加载（返回写法错误）", async () => {
    for (const tex of [String.raw`\href{javascript:alert(1)}{x}`, String.raw`\style{fill:red}{x}`, String.raw`\class{a}{x}`, "<b>x</b>"]) {
      const result = texToSvg(tex);
      if (tex.startsWith("<")) {
        // texhtml 没有加载，< 和 > 只是普通符号
        expect(await result).not.toContain("<b>");
      } else {
        await expect(result).rejects.toBeInstanceOf(RenderError);
      }
    }
  });

  test("未定义的命令仍然报错，不画成红字", async () => {
    await expect(texToSvg(String.raw`\nosuchcommand`)).rejects.toThrow("Undefined control sequence");
  });
});

describe("本库命令名不与 MathJax 的宏包冲突（全部宏包都已加载）", () => {
  const NAMES = [
    "shushi", "vertical", "dengshi", "stepeq", "duanchu", "shortdiv",
    "shuzhuang", "factortree", "shizi", "crossmul", "zonghe", "synthdiv",
    "jin", "carry", "tui", "borrow", "bu", "pad", "hong", "hl", "err", "hua", "strike", "shang", "chu",
  ];
  for (const name of NAMES) {
    test(`\\${name}`, async () => {
      await expect(texToSvg(`\\${name}{1}`)).rejects.toThrow("Undefined control sequence");
    });
  }
});
