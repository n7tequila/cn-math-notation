import { describe, expect, test } from "bun:test";
import { ExpressionError, buildDengshi, buildDengshiLayout, dengshiSteps, dengshiTex } from "../src/index.ts";

/** 去掉 TeX 里的 \times / \div，便于肉眼对照。 */
const plain = (lines: string[]) =>
  lines.map((l) => l.replace(/\\times /g, "×").replace(/\{(-[\d.]+)\}/g, "$1"));
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
    ["7÷3", /除不尽/],
    ["1÷0", /不能是 0/],
    ["1+", /少了一个数/],
    ["(1+2", /小括号没有配对/],
    ["[1+2)", /中括号没有配对/],
    ["1+2)", /多了一个右括号/],
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

describe("只写前几步 steps（维护者 2026-11-26）", () => {
  const BLANK = String.raw`\underline{\hspace{6em}}`;
  const rows = (tex: string) =>
    tex.replace(/^\\begin\{aligned\}|\\end\{aligned\}$/g, "").split(/\\\\\[6pt\]/);

  test("steps=1：题目加一步，后面每步留一个空等号行", () => {
    expect(rows(buildDengshi("2×3×4+1", "steps=1"))).toEqual([
      "&2\\times 3\\times 4+1",
      "={}&6\\times 4+1",
      `={}&${BLANK}`,
      `={}&${BLANK}`,
    ]);
  });

  test("rest=cut：直接截断", () => {
    expect(rows(buildDengshi("2×3×4+1", "steps=1, rest=cut"))).toEqual(["&2\\times 3\\times 4+1", "={}&6\\times 4+1"]);
  });

  test("steps=0 只写题目；steps 不少于总步数时照常写完", () => {
    expect(rows(buildDengshi("1+2+3", "steps=0"))).toEqual(["&1+2+3", `={}&${BLANK}`, `={}&${BLANK}`]);
    expect(buildDengshi("1+2+3", "steps=5")).toBe(buildDengshi("1+2+3"));
  });

  test("直写也能用", () => {
    expect(rows(buildDengshiLayout(String.raw`1+2+3 \\ 3+3 \\ 6`, "steps=1"))).toEqual([
      "&1+2+3",
      "={}&3+3",
      `={}&${BLANK}`,
    ]);
  });

  test("非法选项报错", () => {
    expect(() => buildDengshi("1+2", "steps=-1")).toThrow(/steps/);
    expect(() => buildDengshi("1+2", "steps=a")).toThrow(/steps/);
    expect(() => buildDengshi("1+2", "rest=x")).toThrow(/rest/);
    expect(() => buildDengshi("1+2", "foo")).toThrow(/未知选项/);
  });
});

describe("小数（2026-11-27）", () => {
  test("小数加减乘除，算出来的数去掉末尾的 0", () => {
    expect(steps("0.1+0.2")).toEqual(["0.1+0.2", "0.3"]);
    expect(steps("0.5×0.4+1")).toEqual(["0.5×0.4+1", "0.2+1", "1.2"]);
    expect(steps("2.5+1.5")).toEqual(["2.5+1.5", "4"]);
    expect(steps("1.2÷0.4")).toEqual(["1.2÷0.4", "3"]);
    expect(steps("1÷8")).toEqual(["1÷8", "0.125"]);
    expect(steps("(3.6-1.6)×0.25")).toEqual(["(3.6-1.6)×0.25", "2×0.25", "0.5"]);
  });
  test("题目里写的数照原样保留，包括末尾的 0", () => {
    expect(steps("3.50×2+1")).toEqual(["3.50×2+1", "7+1", "8"]);
  });
  test("除不尽仍报错，提示改用直写", () => {
    expect(() => dengshiSteps("1÷3")).toThrow(/除不尽/);
    expect(() => dengshiSteps("1÷3")).toThrow(/dengshi\*/);
    expect(() => dengshiSteps("1÷0.3")).toThrow(/除不尽/);
  });
});

describe("负数（维护者 2026-11-27：默认允许，负数加括号）", () => {
  test("算出负数：前面是运算符时加括号", () => {
    expect(steps("2×(3-5)")).toEqual(["2×(3-5)", "2×(-2)", "-4"]);
    expect(steps("3-5")).toEqual(["3-5", "-2"]);
  });
  test("开头的负数与紧跟左括号的负数不加括号", () => {
    expect(steps("-2+5")).toEqual(["-2+5", "3"]);
    expect(steps("(-3+1)×2")).toEqual(["(-3+1)×2", "-2×2", "-4"]);
  });
  test("括号只包着一个负数：当作这个数本身，不多算一步去括号；题目里的括号照原样写回", () => {
    expect(steps("(-3)×2+5")).toEqual(["(-3)×2+5", "-6+5", "-1"]);
    expect(steps("5-(-2)")).toEqual(["5-(-2)", "7"]);
    expect(steps("5×(−2)")).toEqual(["5×(-2)", "-10"]);
  });
  test("负数要加括号；负号后面要跟一个数", () => {
    expect(() => dengshiSteps("5×-2")).toThrow(/负数要加括号/);
    expect(() => dengshiSteps("-(3+4)")).toThrow(/负号后面/);
  });
  test("negative=false：不允许负数（小学题防止误写）", () => {
    expect(() => buildDengshi("3-5", "negative=false")).toThrow(/负数/);
    expect(() => buildDengshi("(-3)×2", "negative=false")).toThrow(/负数/);
    expect(buildDengshi("5-3", "negative=false")).toBe(buildDengshi("5-3"));
    expect(() => buildDengshi("1+2", "negative=x")).toThrow(/negative/);
  });
});

describe("生成的 TeX（2026-11-27）", () => {
  test("除号直接写 ÷，不用 \\div（MathJax 的 physics 宏包把 \\div 改成了散度 ∇·）", () => {
    const lines = dengshiSteps("8÷2+1");
    expect(lines[0]).toBe("8÷2+1");
    expect(lines.join("")).not.toContain("\\div");
  });
  test("不在括号里的负数包一层花括号，排成负号而不是减号", () => {
    expect(dengshiSteps("(-3)×2+5")[1]).toBe("{-6}+5");
    expect(dengshiSteps("2×(3-5)")[1]).toBe("2\\times (-2)");
  });
});

describe("审查发现（2026-11-27 第二轮）", () => {
  test("-0 也是“写成负数的数”：括号照原样保留，不多算一步", () => {
    expect(steps("5×(-0)")).toEqual(["5×(-0)", "0"]);
    expect(dengshiSteps("-0+2")[0]).toBe("{-0}+2");
  });
  test("只包着一个负数的中括号照原样写回", () => {
    expect(steps("[-3]+2")[0]).toBe("[-3]+2");
    expect(steps("5×[-3]")[0]).toBe("5×[-3]");
  });
});

test("递等式里的数最多 30 位（2026-11-27 安全审查 H1）", () => {
  expect(() => dengshiSteps(`${"9".repeat(31)}+1`)).toThrow(/最多 30 位/);
  expect(dengshiSteps(`${"9".repeat(30)}+1`).at(-1)).toBe("1" + "0".repeat(30));
});

test("katexMixedDengshi：上方补看不见的行，后面各行的等号用负 kern 挂到左边（2026-11-28）", async () => {
  const { katexMixedDengshi } = await import("../src/index.ts");
  expect(katexMixedDengshi(buildDengshi("1+2+3"))).toBe(
    "\\begin{aligned}&\\vphantom{6}\\\\[6pt]&\\vphantom{3+3}\\\\[6pt]&1+2+3\\\\[6pt]&\\kern-1.3333em{}={}3+3\\\\[6pt]&\\kern-1.3333em{}={}6\\end{aligned}",
  );
});
