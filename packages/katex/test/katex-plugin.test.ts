import { beforeAll, describe, expect, test } from "bun:test";
import katex from "katex";
import { register, type KatexLike } from "../src/index.ts";

beforeAll(() => {
  register(katex as unknown as KatexLike);
});

/** 只取本库生成的 SVG（KaTeX 输出里另带原始 TeX 注释，源码不同整串必然不同）。 */
function svgOf(tex: string): string {
  const m = /<svg[\s\S]*?<\/svg>/.exec(katex.renderToString(tex));
  if (m === null) throw new Error("没有找到 SVG");
  return m[0];
}

const EX1 = String.raw`\shushi*{ 7 4 \\ + 8 8 \\ \jin{1 1 ~} \\ \hline 1 6 2 }`;

describe("原型验证：KaTeX 0.19.1 上的 raw 参数", () => {
  test("锁定的 KaTeX 版本", () => {
    expect(katex.version).toBe("0.19.1");
  });

  test("\\shushi* 在 KaTeX 里渲染出本库的 SVG", () => {
    const html = katex.renderToString(EX1, { displayMode: true });
    expect(html).toContain('class="cmn-shushi"');
    expect(html).toContain("cmn-jin");
    expect(html).toContain("<mstack stackalign=\"right\">");
  });

  test("raw 参数里的真实换行与 \\\\ 分行并存，结果与单行写法相同", () => {
    const multiLine = String.raw`\shushi*{
     7 4 \\
  +  8 8 \\
  \jin{1 1 ~} \\
  \hline
   1 6 2
}`;
    expect(svgOf(multiLine)).toBe(svgOf(EX1));
  });

  test("raw 参数里命令后的空格不影响解析（\\jin {1 1 ~}）", () => {
    const spaced = String.raw`\shushi*{ 7 4 \\ + 8 8 \\ \jin {1 1 ~} \\ \hline 1 6 2 }`;
    expect(svgOf(spaced)).toBe(svgOf(EX1));
  });

  test("SVG 带内联样式，抵消 katex.css 对 .katex svg / path 的规则", () => {
    const svg = svgOf(String.raw`\shushi*{\shang 1 7 \\ \chu{4} 7 1}`);
    expect(svg).toMatch(/<svg[^>]*style="[^"]*position:static[^"]*height:[0-9.]+em/);
    expect(svg).toMatch(/<svg[^>]*style="[^"]*stroke:none/);
    // 嵌进 KaTeX 时用 block，避免基线错位撑出一倍空白（试写页实测）
    expect(svg).toMatch(/<svg[^>]*style="display:block;/);
    expect(svg).toMatch(/class="cmn-bracket" style="stroke:/);
  });

  test("可选参数传入样式选项", () => {
    const html = katex.renderToString(String.raw`\shushi*[guides=false]{ 7 4 \\ + 8 8 }`);
    expect(html).not.toContain("cmn-guide");
  });

  test("英文别名 \\vertical* 等价", () => {
    expect(svgOf(EX1.replace("\\shushi*", "\\vertical*"))).toBe(svgOf(EX1));
  });

  test("与普通公式混写", () => {
    const html = katex.renderToString(String.raw`74+88=162 \quad \shushi*{7 4 \\ + 8 8 \\ \hline 1 6 2}`);
    expect(html).toContain("cmn-shushi");
    expect(html).toContain("mord");
  });

  test("语法错误转成 KaTeX 的 ParseError", () => {
    expect(() => katex.renderToString(String.raw`\shushi*{7 + 4}`)).toThrow(katex.ParseError);
    expect(() => katex.renderToString(String.raw`\shushi*{7 + 4}`)).toThrow(/只能写在一行的开头/);
  });

  test("throwOnError=false 时显示红色错误而不是崩溃", () => {
    const html = katex.renderToString(String.raw`\shushi*{\foo}`, { throwOnError: false });
    expect(html).toContain("katex-error");
  });

  test("~ 被 KaTeX 展开成 \\nobreakspace 后仍当空格子", () => {
    expect(svgOf(String.raw`\shushi*{1 2 9 ~ \\ 3 0 1}`)).toBe(svgOf(String.raw`\shushi*{1 2 9 \nobreakspace \\ 3 0 1}`));
  });

  test("语义式 \\shushi{…} 由程序算出竖式", () => {
    const html = katex.renderToString(String.raw`\shushi{74+88}`);
    expect(html).toContain("cmn-jin");
    expect(html).toContain("<mstack stackalign=\"right\">");
  });

  test("语义式的选项与错误", () => {
    expect(katex.renderToString(String.raw`\shushi[guides=false]{74+88}`)).not.toContain("cmn-guide");
    expect(() => katex.renderToString(String.raw`\shushi{3-5}`)).toThrow(/被减数比减数小/);
    expect(() => katex.renderToString(String.raw`\shushi{1\div0}`)).toThrow(/不能是 0/);
  });

  test("语义式与直写布局画出同一张图", () => {
    expect(svgOf(String.raw`\shushi{74+88}`)).toBe(svgOf(EX1));
  });

  test("register 的 defaults 改变默认样式，[ ] 里的选项仍优先", () => {
    register(katex as unknown as KatexLike, { defaults: { guides: false } });
    expect(katex.renderToString(EX1)).not.toContain("cmn-guide");
    expect(katex.renderToString(EX1.replace("\\shushi*", "\\shushi*[guides=true]"))).toContain("cmn-guide");
    register(katex as unknown as KatexLike);
    expect(katex.renderToString(EX1)).toContain("cmn-guide");
  });

  test("递等式 \\dengshi{…}：程序按运算顺序逐步化简", () => {
    const html = katex.renderToString(String.raw`\dengshi{25\times(40+4)}`, { displayMode: true });
    expect(html).toContain("1100");
    expect(html).toContain("44");
    // MathML 里能看到三行：原式、25×44、1100
    expect((html.match(/<mtr>/g) || []).length).toBe(3);
  });

  test("短除法 \\duanchu / \\duanchu*：画出短除法，MathML 侧给朗读文字；写错报错", () => {
    const html = katex.renderToString(String.raw`\duanchu[result]{36, 48}`);
    expect(html).toContain("cmn-duanchu");
    expect(html).toContain("(36, 48) = 2×2×3 = 12");
    expect(html).toContain("<mtext>短除法：");
    expect(katex.renderToString(String.raw`\shortdiv*{2 | 36 \\ 2 | 18 \\ 3 | 9 \\ 3}`)).toContain("cmn-dc-v");
    expect(() => katex.renderToString(String.raw`\duanchu{37}`)).toThrow(/质数/);
    expect(() => katex.renderToString(String.raw`\duanchu*{2 | x}`)).toThrow(/不认识/);
  });

  test("树状图 \\shuzhuang / \\shuzhuang*：画出树，MathML 侧给朗读文字；写错报错", () => {
    const html = katex.renderToString(String.raw`\shuzhuang[result]{36}`);
    expect(html).toContain("cmn-shuzhuang");
    expect(html).toContain("36 = 2×2×3×3");
    expect(html).toContain("<mtext>树状图：");
    expect(katex.renderToString(String.raw`\factortree*{36 = 4 \times 9 \\ 4 = 2 \times 2}`)).toContain("cmn-tree-edge");
    expect(() => katex.renderToString(String.raw`\shuzhuang{37}`)).toThrow(/质数/);
    expect(() => katex.renderToString(String.raw`\shuzhuang*{36 = 4}`)).toThrow(/因数/);
  });

  test("十字相乘 \\shizi / \\shizi*：画出交叉线与验算行，MathML 侧给朗读文字；写错报错", () => {
    const html = katex.renderToString(String.raw`\shizi[result]{x^2+5x+6}`);
    expect(html).toContain("cmn-shizi");
    expect(html).toContain("<mtext>十字相乘：");
    expect(html).toContain("(x + 2)(x + 3)");
    expect(katex.renderToString(String.raw`\crossmul*{x & +2 \\ x & +3}`)).toContain("cmn-cross-line");
    expect(() => katex.renderToString(String.raw`\shizi{x^2+x+1}`)).toThrow(/整数范围内/);
    expect(() => katex.renderToString(String.raw`\shizi*{x & +2}`)).toThrow(/两行/);
  });

  test("多项式竖式：\\shushi 里有字母就按次数对齐画，直写用 & 分格", () => {
    const html = katex.renderToString(String.raw`\shushi{(x^2+3x+2)\div(x+1)}`);
    expect(html).toContain("cmn-shushi");
    expect(html).toContain("<msup><mi>x</mi><mn>2</mn></msup>");
    expect(katex.renderToString(String.raw`\shushi*{x^2 & +2x & -3 \\ \times & 2x & +1}`)).toContain('font-style="italic"');
    expect(() => katex.renderToString(String.raw`\shushi{(2x^2+1)\div(3x+1)}`)).toThrow(/整数/);
  });

  test("综合除法 \\zonghe / \\zonghe*：画出竖线、横线与余数线，MathML 侧给朗读文字；写错报错", () => {
    const html = katex.renderToString(String.raw`\zonghe[result]{(x^3-1)\div(x-1)}`);
    expect(html).toContain("cmn-zonghe");
    expect(html).toContain("<mtext>综合除法：");
    expect(html).toContain("商 x² + x + 1，余数 0");
    expect(katex.renderToString(String.raw`\synthdiv*{-1 | 1 & 3 & 2 \\ & -1 & -2 \\ 1 & 2 & 0}`)).toContain("cmn-zh-rem");
    expect(() => katex.renderToString(String.raw`\zonghe{(x^2+1)\div(2x+1)}`)).toThrow(/x − a/);
  });

  test("递等式 [steps=1]：只写前几步，后面留空等号行；选项写错报错", () => {
    const html = katex.renderToString(String.raw`\dengshi[steps=1]{2\times3\times4+1}`);
    expect(html).toContain("underline");
    expect(katex.renderToString(String.raw`\dengshi*[steps=1, rest=cut]{1+2+3 \\ 3+3 \\ 6}`)).not.toContain("underline");
    expect(() => katex.renderToString(String.raw`\dengshi[steps=x]{1+2}`)).toThrow(/steps/);
  });

  test("递等式 \\dengshi*{…}：直写，与语义式结果相同", () => {
    const sem = katex.renderToString(String.raw`\dengshi{1+2+3}`);
    const layout = katex.renderToString(String.raw`\dengshi*{1+2+3 \\ 3+3 \\ 6}`);
    const strip = (h: string) => h.replace(/<annotation[\s\S]*?<\/annotation>/, "");
    expect(strip(layout)).toBe(strip(sem));
  });

  test("递等式英文别名 \\stepeq 与报错", () => {
    expect(katex.renderToString(String.raw`\stepeq{1+2+3}`)).toContain("6");
    expect(() => katex.renderToString(String.raw`\dengshi{7\div3}`)).toThrow(/除不尽/);
    expect(katex.renderToString(String.raw`\dengshi{7\div3}`, { throwOnError: false })).toContain("katex-error");
  });

  test("递等式里可以写分数等普通公式（直写）", () => {
    expect(katex.renderToString(String.raw`\dengshi*{\frac{1}{2}+\frac{1}{2} \\ 1}`)).toContain("mfrac");
  });

  test("隐藏的 MathML 是真正的竖式结构：mstack / mscarries / mlongdiv", () => {
    const add = katex.renderToString(String.raw`\shushi{74+88}`);
    expect(add).toContain('<mscarry location="s" crossout="none"><mn mathcolor="#d4402b">1</mn></mscarry>');
    expect(add).toContain("<msline/>");
    expect(katex.renderToString(String.raw`\shushi{71\div4}`)).toContain('<mlongdiv longdivstyle="lefttop"');
  });

  test("register 选项：mathml=label 只给朗读文字；mathmlCarries=above 进位写上方", () => {
    register(katex as unknown as KatexLike, { mathml: "label" });
    expect(katex.renderToString(String.raw`\shushi{74+88}`)).toContain("<mtext>竖式：74，加 88，162</mtext>");
    register(katex as unknown as KatexLike, { mathmlCarries: "above" });
    expect(katex.renderToString(String.raw`\shushi{74+88}`)).toContain('<mscarry location="n" crossout="none">');
    register(katex as unknown as KatexLike);
  });

  test("重复注册无副作用", () => {
    register(katex as unknown as KatexLike);
    expect(katex.renderToString(EX1)).toContain("cmn-shushi");
  });
});

describe("命令名不与 KaTeX 0.19.1 自带的命令冲突", () => {
  // 格子标记写在 raw 参数里由本库解析，但 KaTeX 会先展开里面的宏：KaTeX 自带同名宏就会被替换掉。
  // 注册本库后它们在 KaTeX 里仍然是未定义命令，说明 KaTeX 没有占用这些名字。
  const MARKUP = ["jin", "carry", "tui", "borrow", "bu", "pad", "hong", "hl", "err", "hua", "strike", "shang", "chu"];
  for (const name of MARKUP) {
    test(`\\${name}`, () => {
      expect(() => katex.renderToString(`\\${name}{1}`, { throwOnError: true })).toThrow("Undefined control sequence");
    });
  }
});

describe("\\dengshi 用调用方的 KaTeX 设置解析生成的 TeX", () => {
  test("trust 设置传得进去（\\href 生成链接）", () => {
    const out = katex.renderToString(String.raw`\dengshi*{\href{https://example.com}{x} \\ 2}`, { trust: true });
    expect(out).toContain('href="https://example.com"');
  });
});

describe("混写对齐（维护者 2026-11-28，与 Typora、出图服务一致）", () => {
  test("除法竖式：商那一行对齐基线（盒子在基线以下的深度 = 总高 − baselineEm）", async () => {
    const { renderShushi } = await import("@cn-math-notation/core");
    const r = renderShushi("7÷3");
    const html = katex.renderToString(String.raw`\text{商 }\shushi{7\div3}`);
    const depth = r.heightEm - r.baselineEm!;
    expect(html).toContain(`vertical-align:${(-depth).toFixed(3)}em`);
  });

  test("其他竖式仍上下居中对着公式中线", async () => {
    const { renderShushi } = await import("@cn-math-notation/core");
    const r = renderShushi("74+88");
    const depth = r.heightEm - (r.heightEm / 2 + 0.25);
    expect(katex.renderToString(String.raw`x+\shushi{74+88}`)).toContain(`vertical-align:${(-depth).toFixed(3)}em`);
  });

  test("混写的递等式：后面各行的等号挂在左边（负 kern），单独写时照旧", () => {
    const mixed = katex.renderToString(String.raw`S=\dengshi{2\times(3+4)}`);
    const alone = katex.renderToString(String.raw`\dengshi{2\times(3+4)}`);
    expect(mixed).toContain("-1.3333em");
    expect(alone).not.toContain("-1.3333em");
  });
});
