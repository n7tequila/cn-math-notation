import { describe, expect, test } from "bun:test";
import { ExpressionError, buildDengshi, buildDengshiLayout, dengshiSteps, dengshiTex } from "../src/index.ts";

/** 去掉 TeX 里的 \times / \div，便于肉眼对照。 */
const plain = (lines: string[]) => lines.map((l) => l.replace(/\\times /g, "×").replace(/\\div /g, "÷"));
const steps = (expr: string) => plain(dengshiSteps(expr));

describe("运算顺序", () => {
  test("有括号先算括号里面", () => {
    expect(steps("25×(40+4)")).toEqual(["25×(40+4)", "25×44", "1100"]);
  });
  test("先乘除后加减，互不影响的乘除同一步算", () => {
    expect(steps("25×4+36÷6")).toEqual(["25×4+36÷6", "100+6", "106"]);
  });
  test("同级从左往右，一次一步", () => {
    expect(steps("2×3×4+1")).toEqual(["2×3×4+1", "6×4+1", "24+1", "25"]);
    expect(steps("1+2+3")).toEqual(["1+2+3", "3+3", "6"]);
    expect(steps("100-30+20")).toEqual(["100-30+20", "70+20", "90"]);
  });
  test("有乘法时，前面的加减也要等乘法算完", () => {
    expect(steps("20-5+3×4")).toEqual(["20-5+3×4", "20-5+12", "15+12", "27"]);
  });
  test("括号外的运算等括号算完再算", () => {
    expect(steps("3×4+(5+6)")).toEqual(["3×4+(5+6)", "3×4+11", "12+11", "23"]);
  });
  test("两个括号互不影响，同一步算", () => {
    expect(steps("(12+8)×(5-3)")).toEqual(["(12+8)×(5-3)", "20×2", "40"]);
  });
  test("中括号里套小括号：先小括号，再中括号", () => {
    expect(steps("[100-(20+30)]÷5")).toEqual(["[100-(20+30)]÷5", "[100-50]÷5", "50÷5", "10"]);
  });
  test("括号里有多步时一步一步算，算成一个数才去掉括号", () => {
    expect(steps("(2+3×4)×5")).toEqual(["(2+3×4)×5", "(2+12)×5", "14×5", "70"]);
  });
  test("各种符号写法：\\times \\div * / 全角括号", () => {
    expect(steps(String.raw`25\times(40+4)`)).toEqual(steps("25*(40+4)"));
    expect(steps(String.raw`36\div6`)).toEqual(steps("36/6"));
    expect(steps("25×（40+4）")).toEqual(steps("25×(40+4)"));
    expect(steps(String.raw`25\times\left(40+4\right)`)).toEqual(steps("25×(40+4)"));
  });
});

describe("报错", () => {
  const bad: [string, RegExp][] = [
    ["7÷2", /除不尽/],
    ["3-5", /负数/],
    ["1÷0", /不能是 0/],
    ["1+", /少了一个数/],
    ["(1+2", /小括号没有配对/],
    ["[1+2)", /中括号没有配对/],
    ["1+2)", /多了一个右括号/],
    ["1.5+2", /小数/],
    ["12", /只有一个数/],
    ["", /空/],
    ["2(3+4)", /少了运算符/],
  ];
  for (const [src, msg] of bad) {
    test(src || "（空）", () => {
      expect(() => dengshiSteps(src)).toThrow(ExpressionError);
      expect(() => dengshiSteps(src)).toThrow(msg);
    });
  }
});

describe("排版：等号悬在算式左边", () => {
  test("第一行不写等号，之后每行以等号开头，等号在对齐点左边", () => {
    expect(dengshiTex(["a", "b", "c"])).toBe(String.raw`\begin{aligned}&a\\[6pt]={}&b\\[6pt]={}&c\end{aligned}`);
  });
  test("语义式一步到位", () => {
    expect(buildDengshi("1+2+3")).toBe(String.raw`\begin{aligned}&1+2+3\\[6pt]={}&3+3\\[6pt]={}&6\end{aligned}`);
  });
  test("直写：\\\\ 分行，行首的等号写不写都行", () => {
    const a = buildDengshiLayout(String.raw`25\times(40+4) \\ 25\times44 \\ 1100`);
    const b = buildDengshiLayout(String.raw`25\times(40+4) \\ = 25\times44 \\ =1100`);
    expect(a).toBe(b);
    expect(a).toContain(String.raw`={}&25\times44`);
  });
});
