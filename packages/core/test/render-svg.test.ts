import { describe, expect, test } from "bun:test";
import { OptionError, parseLayout, parseOptions, renderLayout, renderShushiLayout, DEFAULT_STYLE } from "../src/index.ts";

const EX1 = String.raw`7 4 \\ + 8 8 \\ \jin{1 1 ~} \\ \hline 1 6 2`;

function countOf(svg: string, needle: string): number {
  return svg.split(needle).length - 1;
}

/** 取出某个 class 的 text 元素的 x 坐标。 */
function xsOf(svg: string, cls: string): number[] {
  return [...svg.matchAll(new RegExp(`<text x="([0-9.]+)"[^>]*class="${cls}"`, "g"))].map((m) => Number(m[1]));
}

describe("renderLayout", () => {
  test("例 1 输出合法 SVG，带朗读文字", () => {
    const out = renderShushiLayout(EX1);
    expect(out.svg.startsWith("<svg")).toBe(true);
    expect(out.svg.endsWith("</svg>")).toBe(true);
    expect(out.label).toBe("竖式：74，加 88，162");
    expect(out.svg).toContain('aria-label="竖式：74，加 88，162"');
    expect(out.widthEm).toBeGreaterThan(0);
  });

  test("两个进位、7 个数字、1 条横线、运算符", () => {
    const out = renderShushiLayout(EX1, "guides=false");
    expect(countOf(out.svg, 'class="cmn-jin"')).toBe(2);
    expect(countOf(out.svg, "<line")).toBe(1);
    expect(out.svg).toContain(">+</text>");
  });

  test("guides 默认开，可关", () => {
    expect(renderShushiLayout(EX1).svg).toContain("cmn-guide");
    expect(renderShushiLayout(EX1, "guides=false").svg).not.toContain("cmn-guide");
  });

  test("carryAt=sw 时进位比 s 偏右（贴近产生进位的那一位）", () => {
    const s = xsOf(renderShushiLayout(EX1).svg, "cmn-jin");
    const sw = xsOf(renderShushiLayout(EX1, "carryAt=sw").svg, "cmn-jin");
    expect(sw.length).toBe(2);
    sw.forEach((x, i) => expect(x).toBeGreaterThan(s[i]!));
  });

  test("退位点、补 0、错误高亮、划掉都画出来", () => {
    expect(renderShushiLayout(String.raw`\tui{40} 3 \\ - 1 6 7`).svg).toContain("cmn-tui");
    expect(renderShushiLayout(String.raw`30.5\bu{0} \\ - 25.21`).svg).toContain("cmn-bu");
    expect(renderShushiLayout(String.raw`\err{3} 4 6`).svg).toContain("cmn-err");
    expect(renderShushiLayout(String.raw`\hua{3} 4 6`).svg).toContain("<line");
  });

  test("小数竖式也画数位虚线：默认小数点不占列；pointColumn 时小数点那条窄列两侧各一条", () => {
    const svg = renderShushiLayout(String.raw`24.5 \\ + 16.3 \\ \hline 40.8`).svg;
    // 十位、个位、十分位三列的左边界 + 最右边界 = 4 条
    expect(countOf(svg, "cmn-guide")).toBe(4);
    const old = renderShushiLayout(String.raw`24.5 \\ + 16.3 \\ \hline 40.8`, "pointColumn").svg;
    // 十位、个位、小数点、十分位四列的左边界 + 最右边界 = 5 条
    expect(countOf(old, "cmn-guide")).toBe(5);
    expect(renderShushiLayout(String.raw`24.5 \\ + 16.3`, "guides=false").svg).not.toContain("cmn-guide");
  });

  test("长除法画出括号和除数", () => {
    const out = renderShushiLayout(String.raw`\shang 1 7 \\ \chu{4} 7 1 \\ 4 ~ \\ \hline 3 1 \\ 2 8 \\ \hline 3`);
    expect(out.svg).toContain("cmn-bracket");
    expect(out.label).toContain("71 除以 4");
  });

  test("根元素默认 inline-block，可指定 block", () => {
    expect(renderShushiLayout(EX1).svg).toMatch(/style="display:inline-block;/);
    expect(renderShushiLayout(EX1, undefined, DEFAULT_STYLE, { display: "block" }).svg).toMatch(/style="display:block;/);
  });

  test("textcolor 的颜色用在数字上", () => {
    expect(renderShushiLayout(String.raw`\textcolor{blue}{1 2}`).svg).toContain('fill="blue"');
  });

  test("operatorPlacement=adjacent 时运算符离数字更近", () => {
    const far = renderLayout(parseLayout(String.raw`4 3 \\ \times 3 7`), DEFAULT_STYLE);
    const adj = renderLayout(parseLayout(String.raw`4 3 \\ \times 3 7`), parseOptions("operatorPlacement=adjacent"));
    const opX = (svg: string) => Number(/<text x="([0-9.]+)"[^>]*>×<\/text>/.exec(svg)![1]);
    const firstDigitX = (svg: string) => Number(/<text x="([0-9.]+)"[^>]*>3<\/text>/.exec(svg)![1]);
    expect(firstDigitX(adj.svg) - opX(adj.svg)).toBeLessThan(firstDigitX(far.svg) - opX(far.svg));
  });
});

describe("parseOptions", () => {
  test("默认值是沪教版", () => {
    expect(parseOptions(undefined)).toEqual({
      carryAt: "s",
      guides: true,
      multiCarry: false,
      padZero: true,
      colorByDigit: false,
      operatorPlacement: "far",
      mode: "compact",
      strikeZero: true,
      process: "auto",
      carry: true,
      markPoint: false,
      markAppended: false,
      remainder: false,
      pointColumn: false,
      coefficients: false,
    });
  });
  test("只写键名表示 true", () => {
    expect(parseOptions("multiCarry").multiCarry).toBe(true);
  });
  test("非法值与未知键报错", () => {
    expect(() => parseOptions("carryAt=se")).toThrow(OptionError);
    expect(() => parseOptions("guides=yes")).toThrow(OptionError);
    expect(() => parseOptions("color=red")).toThrow(/未知选项/);
  });
});
