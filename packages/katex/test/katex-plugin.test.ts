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
    expect(html).toContain("<mtext>竖式：74，加 88，162</mtext>");
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
    expect(html).toContain("<mtext>竖式：74，加 88，162</mtext>");
  });

  test("语义式的选项与错误", () => {
    expect(katex.renderToString(String.raw`\shushi[guides=false]{74+88}`)).not.toContain("cmn-guide");
    expect(() => katex.renderToString(String.raw`\shushi{3-5}`)).toThrow(/被减数比减数小/);
    expect(() => katex.renderToString(String.raw`\shushi{1.2\times3}`)).toThrow(/第二期/);
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

  test("重复注册无副作用", () => {
    register(katex as unknown as KatexLike);
    expect(katex.renderToString(EX1)).toContain("cmn-shushi");
  });
});
