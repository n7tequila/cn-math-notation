import { describe, expect, test } from "bun:test";
import { texToSvg } from "../src/mathjax.ts";
import { RenderError } from "../src/render-error.ts";
import { CMN_PACKAGE } from "../src/cmn-tex.ts";
import { TEX_PACKAGES } from "../src/tex-packages.ts";

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

describe("本库命令名不与 MathJax 的宏包冲突（除本库自己的 cmn 外，全部宏包都已加载）", () => {
  const OTHERS = TEX_PACKAGES.filter((p) => p !== CMN_PACKAGE);
  const NAMES = [
    "shushi", "vertical", "dengshi", "stepeq", "duanchu", "shortdiv",
    "shuzhuang", "factortree", "shizi", "crossmul", "zonghe", "synthdiv",
    "jin", "carry", "tui", "borrow", "bu", "pad", "hong", "hl", "err", "hua", "strike", "shang", "chu",
  ];
  for (const name of NAMES) {
    test(`\\${name}`, async () => {
      await expect(texToSvg(`\\${name}{1}`, OTHERS)).rejects.toThrow("Undefined control sequence");
    });
  }
  test("对照：加上 cmn 后本库命令能认出来，格内标记命令仍未定义", async () => {
    expect(await texToSvg("x+\\shushi{1+1}")).toContain("<svg");
    await expect(texToSvg("\\jin{1}")).rejects.toThrow("Undefined control sequence");
  });
});

describe("混写只用 Typora 默认就有的命令（2026-11-27：\\mathllap 在 Typora 里未定义）", () => {
  const TYPORA_DEFAULT = ["base", "ams", "newcommand", "configmacros", CMN_PACKAGE];
  test("递等式、竖式混写在只加载默认宏包时也能排", async () => {
    for (const tex of [String.raw`S=\dengshi{2\times(3+4)}`, String.raw`S=\dengshi[steps=1]{2\times3+1}`, String.raw`1+\shushi{3+4}=7`]) {
      expect(await texToSvg(tex, TYPORA_DEFAULT)).toContain("<svg");
    }
  });
});

describe("混写的注入（2026-11-27）", () => {
  test("用 \\mmlToken 伪造本库盒子的属性：插不进别的 SVG", async () => {
    const evil = btoa('<svg viewBox="0 0 24 24" width="1em" height="1em" onload="alert(1)"><script>alert(2)</script></svg>');
    const tex = `\\mmlToken{mi}[class="cmn-embed" data-cmn-svg="${evil}"]{x}`;
    const svg = await texToSvg(tex).catch((e: Error) => e.message);
    expect(svg).not.toContain("onload");
    expect(svg).not.toContain("<script");
  });
});

describe("审查发现的问题（2026-11-27）", () => {
  test("一个请求里的 \\newcommand、\\def、\\definecolor 不影响后面的请求", async () => {
    const before = await texToSvg(String.raw`\frac12+\pi+\color{red}{x}`);
    await texToSvg(String.raw`\newcommand{\frac}[2]{EVIL}\def\pi{HACK}\definecolor{red}{RGB}{0,255,0}x`);
    const after = await texToSvg(String.raw`\frac12+\pi+\color{red}{x}`);
    expect(after).toBe(before);
  });

  test("属性值里不留未转义的 < >（输出总是合法 XML）", async () => {
    for (const tex of [String.raw`\color{<}{x}`, String.raw`\unicode[a<b]{x41}`, String.raw`\enclose{circle}[mathcolor=<]{x}`]) {
      const svg = await texToSvg(tex).catch(() => "<svg/>");
      expect(svg).not.toMatch(/="[^"]*[<>][^"]*"/);
    }
  });

  test("\\bbox 写的 CSS 不能带外部地址", async () => {
    const svg = await texToSvg(String.raw`\bbox[background:url(http://evil.example/x.png)]{x}`);
    expect(svg).not.toContain("url(");
    expect(svg).not.toContain("evil.example");
    expect((await texToSvg(String.raw`\bbox[yellow,5px,border:2px solid red]{x}`)).startsWith("<svg")).toBe(true);
  });

  test("\\mathtip、\\toggle 等交互命令不加载，返回写法错误而不是内部错误", async () => {
    for (const tex of [String.raw`\mathtip{x}{y}`, String.raw`\texttip{x}{y}`, String.raw`\toggle{a}{b}\endtoggle`]) {
      await expect(texToSvg(tex)).rejects.toBeInstanceOf(RenderError);
    }
  });

  test("\\mmlToken 的 href 不会变成链接，内部的 #MJX 字形引用保留", async () => {
    const svg = await texToSvg(String.raw`\mmlToken{mi}[href="javascript:alert(1)"]{x}+y`);
    expect(svg).not.toContain("javascript:");
    expect(svg).not.toMatch(/\shref="(?!#)/);
    expect(svg).toMatch(/xlink:href="#MJX-CMN-/);
  });
});
