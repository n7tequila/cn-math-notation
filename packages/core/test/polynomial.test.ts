import { describe, expect, test } from "bun:test";
import {
  DEFAULT_STYLE,
  ExpressionError,
  LayoutSyntaxError,
  buildSemantic,
  layoutToMathML,
  parseLayout,
  parseOptions,
  renderLayout,
  type Cell,
  type Layout,
  type Row,
} from "../src/index.ts";

const style = (opts?: string) => parseOptions(opts, DEFAULT_STYLE);
const build = (expr: string, opts?: string) => buildSemantic(expr, style(opts));

function text(c: Cell): string {
  if (c.content.kind === "term") return c.content.text;
  if (c.content.kind === "digit") return c.content.text;
  return "~";
}

/** 每行写成 "列:项" 列表。 */
function shape(layout: Layout): string[] {
  return layout.rows.map((r: Row) => {
    if (r.kind === "hline") return "---";
    const tag = r.kind === "digits" && r.quotient ? "shang " : "";
    const op = r.kind === "digits" && r.operator !== undefined ? `${r.operator} ` : "";
    const div = r.kind === "digits" && r.divisor !== undefined ? `chu(${r.divisor}) ` : "";
    return `${tag}${op}${div}${r.cells.map((c) => `${c.col}:${text(c)}`).join(" ")}`;
  });
}

describe("多项式乘法竖式", () => {
  test("(x²+2x−3)(2x+1)：第二个因式从低次项起每项乘一行，按次数错位再相加", () => {
    expect(shape(build("(x^2+2x-3)(2x+1)"))).toEqual([
      "2:x² 1:+2x 0:−3",
      "× 1:2x 0:+1",
      "---",
      "2:x² 1:+2x 0:−3",
      "3:2x³ 2:+4x² 1:−6x",
      "---",
      "3:2x³ 2:+5x² 1:−4x 0:−3",
    ]);
    expect(shape(build(String.raw`(x^2+2x-3)\times(2x+1)`))).toEqual(shape(build("(x^2+2x-3)(2x+1)")));
  });

  test("乘一个单项式：只有一行积", () => {
    expect(shape(build(String.raw`(x^2-1)\times 3x`))).toEqual(["2:x² 0:−1", "× 1:3x", "---", "3:3x³ 1:−3x"]);
  });

  test("分离系数法：只写系数，缺项写 0", () => {
    expect(shape(build("(x^2-1)(x+2)", "coefficients"))).toEqual([
      "2:1 1:+0 0:−1",
      "× 1:1 0:+2",
      "---",
      "2:2 1:+0 0:−2",
      "3:1 2:+0 1:−1",
      "---",
      "3:1 2:+2 1:−1 0:−2",
    ]);
  });
});

describe("多项式长除法", () => {
  test("(x²+3x+2)÷(x+1)：商的每一项写在被除式同次项上方", () => {
    expect(shape(build(String.raw`(x^2+3x+2)\div(x+1)`))).toEqual([
      "shang 1:x 0:+2",
      "chu(x+1) 2:x² 1:+3x 0:+2",
      "2:x² 1:+x",
      "---",
      "1:2x 0:+2",
      "1:2x 0:+2",
      "---",
      "0:0",
    ]);
  });

  test("(x³−1)÷(x−1)：缺项留空位", () => {
    expect(shape(build("(x^3-1)÷(x-1)"))).toEqual([
      "shang 2:x² 1:+x 0:+1",
      "chu(x−1) 3:x³ 0:−1",
      "3:x³ 2:−x²",
      "---",
      "2:x² 0:−1",
      "2:x² 1:−x",
      "---",
      "1:x 0:−1",
      "1:x 0:−1",
      "---",
      "0:0",
    ]);
  });

  test("分离系数法：缺项写 0，除式也只写系数", () => {
    expect(shape(build("(x^3-1)÷(x-1)", "coefficients")).slice(0, 5)).toEqual([
      "shang 2:1 1:+1 0:+1",
      "chu(1−1) 3:1 2:+0 1:+0 0:−1",
      "3:1 2:−1",
      "---",
      "2:1 1:+0 0:−1",
    ]);
  });

  test("除不尽时最后写余式：(x²+1)÷(x+1)", () => {
    expect(shape(build("(x^2+1)÷(x+1)"))).toEqual([
      "shang 1:x 0:−1",
      "chu(x+1) 2:x² 0:+1",
      "2:x² 1:+x",
      "---",
      "1:−x 0:+1",
      "1:−x 0:−1",
      "---",
      "0:2",
    ]);
  });

  test("不能列式的报错", () => {
    expect(() => build("(2x^2+1)÷(3x+1)")).toThrow(/整数/);
    expect(() => build("(x+1)÷(x^2+1)")).toThrow(/次数/);
    expect(() => build("(x+y)(x-y)")).toThrow(/一个字母/);
    expect(() => build("(x^2+1)÷(x+1)=x")).toThrow(/答案/);
    expect(() => build("(x^2+1)+(x+1)")).toThrow(ExpressionError);
  });
});

describe("直写：& 分格写多项式", () => {
  test("各格从右往左依次是常数项、一次项……；空格是缺项", () => {
    const l = parseLayout(
      String.raw`\shang x & +2 \\ \chu{x+1} x^2 & +3x & +2 \\ x^2 & +x & \\ \hline 2x & +2 \\ 2x & +2 \\ \hline 0`,
    );
    expect(shape(l)).toEqual([
      "shang 1:x 0:+2",
      "chu(x+1) 2:x² 1:+3x 0:+2",
      "2:x² 1:+x 0:~",
      "---",
      "1:2x 0:+2",
      "1:2x 0:+2",
      "---",
      "0:0",
    ]);
  });

  test("运算符单独写在第一格；\\err 标出整项", () => {
    const l = parseLayout(String.raw`x^2 & +2x & -3 \\ \times & 2x & +1 \\ \hline x^2 & \err{+3x} & -3`);
    expect(shape(l)[1]).toBe("× 1:2x 0:+1");
    const last = l.rows.at(-1)!;
    expect(last.kind === "digits" && last.cells[1]!.marks).toEqual(["err"]);
  });

  test("一格里写了不认识的东西报错", () => {
    expect(() => parseLayout(String.raw`x^2 & \frac{1}{2}`)).toThrow(LayoutSyntaxError);
  });
});

describe("多项式竖式的渲染与导出", () => {
  test("SVG：项排成斜体，不画数位虚线，列宽随项变宽", () => {
    const svg = renderLayout(build("(x^2+2x-3)(2x+1)"), style()).svg;
    expect(svg).toContain('font-style="italic"');
    expect(svg).not.toContain("cmn-guide");
  });

  test("MathML：项拆成 mo / mn / mi / msup", () => {
    const m = layoutToMathML(build(String.raw`(x^2+3x+2)\div(x+1)`));
    expect(m).toContain("<msup><mi>x</mi><mn>2</mn></msup>");
    expect(m).toContain("<mrow><mo>+</mo><mn>3</mn><mi>x</mi></mrow>");
    expect(m).toContain("<mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow>");
  });
});
