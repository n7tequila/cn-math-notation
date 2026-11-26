import { describe, expect, test } from "bun:test";
import {
  DEFAULT_STYLE,
  ExpressionError,
  buildSemantic,
  parseExpression,
  parseOptions,
  type Cell,
  type Layout,
  type Row,
} from "../src/index.ts";

const style = (opts?: string) => parseOptions(opts, DEFAULT_STYLE);
const build = (expr: string, opts?: string) => buildSemantic(expr, style(opts));

/** 一行写成 "列:数字" 列表，便于断言位置。 */
function cols(cells: readonly Cell[]): string {
  return cells
    .map((c) => `${c.col}:${c.content.kind === "digit" ? c.content.text : c.content.kind === "point" ? "." : "~"}`)
    .join(" ");
}
function shape(layout: Layout): string[] {
  return layout.rows.map((r: Row) => {
    if (r.kind === "hline") return "---";
    const tag = r.kind === "carry" ? "jin " : r.kind === "digits" && r.quotient ? "shang " : "";
    const op = r.kind === "digits" && r.operator !== undefined ? `${r.operator} ` : "";
    const div = r.kind === "digits" && r.divisor !== undefined ? `chu${r.divisor} ` : "";
    return `${tag}${op}${div}${cols(r.cells)}`;
  });
}
function marksOf(row: Row | undefined): string[][] {
  return row !== undefined && row.kind !== "hline" ? row.cells.map((c) => [...c.marks]) : [];
}

describe("算式解析", () => {
  test("各种运算符写法", () => {
    for (const [src, op] of [
      ["74+88", "+"],
      ["403-167", "-"],
      ["403−167", "-"],
      [String.raw`43\times37`, "×"],
      ["43×37", "×"],
      ["43*37", "×"],
      [String.raw`71\div4`, "÷"],
      ["71÷4", "÷"],
      ["71/4", "÷"],
    ] as const) {
      expect(parseExpression(src).op).toBe(op);
    }
  });
  test("空白与 KaTeX 展开的 ~ 被忽略", () => {
    expect(parseExpression(String.raw` 74 + 88 `)).toEqual(parseExpression("74+88"));
    expect(parseExpression(String.raw`74\nobreakspace+88`)).toEqual(parseExpression("74+88"));
  });
  test("孩子的答案与除法余数", () => {
    expect(parseExpression("403-167=346").answer).toEqual({ int: "346", frac: "" });
    const d = parseExpression("71÷4=17……3");
    expect([d.answer?.int, d.remainder?.int]).toEqual(["17", "3"]);
    expect(parseExpression("71÷4=17...3").remainder?.int).toBe("3");
    expect(parseExpression("71÷4=17r3").remainder?.int).toBe("3");
  });
  const bad: [string, RegExp][] = [
    ["", /空/],
    ["abc", /数字/],
    ["7+", /数字/],
    ["7%3", /\+ − × ÷/],
    ["7+3=", /答案/],
    ["7+3=10……1", /只有除法/],
    ["7+3+4", /等号或结尾/],
  ];
  for (const [src, msg] of bad) {
    test(`报错：${src || "（空）"}`, () => {
      expect(() => parseExpression(src)).toThrow(ExpressionError);
      expect(() => parseExpression(src)).toThrow(msg);
    });
  }
});

describe("加法", () => {
  test("74+88：进位记在进到的那一列，与直写布局一致", () => {
    expect(shape(build("74+88"))).toEqual(["1:7 0:4", "+ 1:8 0:8", "jin 2:1 1:1", "---", "2:1 1:6 0:2"]);
  });
  test("没有进位就不画进位行", () => {
    expect(shape(build("12+34"))).toEqual(["1:1 0:2", "+ 1:3 0:4", "---", "1:4 0:6"]);
  });
  test("小数 24.5+16.3：按小数点对齐，十分位不进位、个位进位", () => {
    const l = build("24.5+16.3");
    expect(l.hasDecimal).toBe(true);
    expect(shape(l)).toEqual(["1:2 0:4 -0.5:. -1:5", "+ 1:1 0:6 -0.5:. -1:3", "jin 1:1", "---", "1:4 0:0 -0.5:. -1:8"]);
  });
  test("结果末尾的 0 划掉（strikeZero，默认开）：2.5+1.5=4.0、3.45+1.55=5.00", () => {
    expect(marksOf(build("2.5+1.5").rows.at(-1))).toEqual([[], [], ["hua"]]);
    expect(marksOf(build("3.45+1.55").rows.at(-1))).toEqual([[], [], ["hua"], ["hua"]]);
    expect(marksOf(build("2.15+2.45").rows.at(-1))).toEqual([[], [], [], ["hua"]]);
    expect(marksOf(build("2.5+1.5", "strikeZero=false").rows.at(-1)).flat()).toEqual([]);
  });
  test("减法结果末尾的 0 同样划掉（5.75−1.25=4.50）", () => {
    expect(marksOf(build("5.75-1.25").rows.at(-1))).toEqual([[], [], [], ["hua"]]);
  });
  test("孩子写的答案不划 0", () => {
    expect(marksOf(build("2.5+1.5=4.0").rows.at(-1)).flat()).not.toContain("hua");
  });
  test("小数位数不同：padZero 默认补 0 并标出，关掉则不补", () => {
    expect(marksOf(build("2.5+1.25").rows[0])).toEqual([[], [], [], ["bu"]]);
    expect(shape(build("2.5+1.25", "padZero=false"))[0]).toBe("0:2 -0.5:. -1:5");
  });
});

describe("减法", () => {
  test("165−84：向百位借，百位打点；结果不写前导 0", () => {
    const l = build("165-84");
    expect(marksOf(l.rows[0])).toEqual([["tui"], [], []]);
    expect(shape(l)[3]).toBe("1:8 0:1");
  });
  test("403−167：跨 0 退位，百位、十位各一个点（维护者裁决：只打点）", () => {
    const l = build("403-167");
    expect(marksOf(l.rows[0])).toEqual([["tui"], ["tui"], []]);
    expect(shape(l)[3]).toBe("2:2 1:3 0:6");
  });
  test("30.5−25.21：被减数补 0（虚线框）；个位向十位借、百分位向十分位借", () => {
    const l = build("30.5-25.21");
    expect(shape(l)[0]).toBe("1:3 0:0 -0.5:. -1:5 -2:0");
    expect(marksOf(l.rows[0])).toEqual([["tui"], [], [], ["tui"], ["bu"]]);
    expect(shape(l)[3]).toBe("0:5 -0.5:. -1:2 -2:9");
  });
  test("被减数比减数小报错", () => {
    expect(() => build("3-5")).toThrow(/被减数比减数小/);
  });
});

describe("一位数乘法", () => {
  test("23×4 简写：进位 1 记在十位", () => {
    expect(shape(build("23×4"))).toEqual(["1:2 0:3", "× 0:4", "jin 1:1", "---", "1:9 0:2"]);
  });
  test("538×6：最高位的进位直接写进积，不画小字", () => {
    expect(shape(build("538×6"))[2]).toBe("jin 2:2 1:4");
    expect(shape(build("538×6"))[4]).toBe("3:3 2:2 1:2 0:8");
  });
  test("23×4 分步式（mode=expanded）：12、80 两行再相加", () => {
    expect(shape(build("23×4", "mode=expanded"))).toEqual([
      "1:2 0:3",
      "× 0:4",
      "---",
      "1:1 0:2",
      "1:8 0:0",
      "---",
      "1:9 0:2",
    ]);
  });
});

describe("多位数乘法", () => {
  test("43×37：第二个部分积左移一位、末位空着；默认不画进位", () => {
    expect(shape(build("43×37"))).toEqual([
      "1:4 0:3",
      "× 1:3 0:7",
      "---",
      "2:3 1:0 0:1",
      "3:1 2:2 1:9",
      "---",
      "3:1 2:5 1:9 0:1",
    ]);
  });
  test("538×26 multiCarry：第一组进位在横线前，第二组在第二个部分积上方", () => {
    expect(shape(build("538×26", "multiCarry"))).toEqual([
      "2:5 1:3 0:8",
      "× 1:2 0:6",
      "jin 2:2 1:4",
      "---",
      "3:3 2:2 1:2 0:8",
      "jin 2:1",
      "4:1 3:0 2:7 1:6",
      "---",
      "4:1 3:3 2:9 1:8 0:8",
    ]);
  });
  test("colorByDigit：乘数每一位与它的进位、部分积同色", () => {
    const l = build("538×26", "multiCarry, colorByDigit");
    const colorOf = (i: number) => {
      const r = l.rows[i]!;
      return r.kind === "hline" ? [] : [...new Set(r.cells.map((c) => c.color))];
    };
    expect(colorOf(1)).toEqual(["#2f6fd6", "#d4402b"]); // 乘数：十位蓝、个位红
    expect(colorOf(2)).toEqual(["#d4402b"]);
    expect(colorOf(4)).toEqual(["#d4402b"]);
    expect(colorOf(5)).toEqual(["#2f6fd6"]);
    expect(colorOf(6)).toEqual(["#2f6fd6"]);
    expect(colorOf(8)).toEqual([undefined]);
  });
  test("乘数中间有 0（43×205）：0 那一位不写部分积", () => {
    const s = shape(build("43×205"));
    expect(s.slice(3, 5)).toEqual(["2:2 1:1 0:5", "3:8 2:6"]);
    expect(s[6]).toBe("3:8 2:8 1:1 0:5");
  });
  test("被乘数末尾有 0（380×3，样本）：3 对齐 8，0 甩在外面，进位 2 在百位，积 1140", () => {
    expect(shape(build("380×3"))).toEqual(["2:3 1:8 0:0", "× 1:3", "jin 2:2", "---", "3:1 2:1 1:4 0:0"]);
  });
  test("乘数末尾有 0（25×30）：3 对齐 5，积 750", () => {
    expect(shape(build("25×30"))).toEqual(["2:2 1:5", "× 1:3 0:0", "jin 2:1", "---", "2:7 1:5 0:0"]);
  });
  test("两个因数末尾都有 0（120×30）：0 前面的数对齐，积 3600", () => {
    expect(shape(build("120×30"))).toEqual(["3:1 2:2 1:0", "× 2:3 1:0", "---", "3:3 2:6 1:0 0:0"]);
  });
  test("因数末尾有 0 的多位数乘法（120×34）：部分积从 0 前面那一列算起", () => {
    expect(shape(build("120×34"))).toEqual([
      "2:1 1:2 0:0",
      "× 2:3 1:4",
      "---",
      "2:4 1:8",
      "3:3 2:6",
      "---",
      "3:4 2:0 1:8 0:0",
    ]);
  });
  test("三位数乘一位数（329×4，样本）：简写，进位 3、1", () => {
    expect(shape(build("329×4"))).toEqual(["2:3 1:2 0:9", "× 0:4", "jin 2:1 1:3", "---", "3:1 2:3 1:1 0:6"]);
  });
});

describe("除法", () => {
  test("71÷4（样本）：remainder 时商 17，余 3", () => {
    expect(shape(build("71÷4", "remainder"))).toEqual([
      "shang 1:1 0:7",
      "chu4 1:7 0:1",
      "1:4",
      "---",
      "1:3 0:1",
      "1:2 0:8",
      "---",
      "0:3",
    ]);
  });
  test("96÷3：整除时最后写 0", () => {
    expect(shape(build("96÷3")).slice(-4)).toEqual(["0:6", "0:6", "---", "0:0"]);
  });
  test("812÷4：商中间有 0，不写那一步的乘积，直接落下一位", () => {
    expect(shape(build("812÷4"))).toEqual([
      "shang 2:2 1:0 0:3",
      "chu4 2:8 1:1 0:2",
      "2:8",
      "---",
      "1:1 0:2",
      "1:1 0:2",
      "---",
      "0:0",
    ]);
  });
  test("81÷4：商末尾是 0，余数 1", () => {
    expect(shape(build("81÷4", "remainder"))).toEqual(["shang 1:2 0:0", "chu4 1:8 0:1", "1:8", "---", "0:1"]);
  });
  test("首位不够除（156÷3）：商从十位开始", () => {
    expect(shape(build("156÷3"))[0]).toBe("shang 1:5 0:2");
    expect(shape(build("156÷3"))[2]).toBe("2:1 1:5"); // 第一步乘积 15 与被除数的“15”对齐
  });
  test("被除数比除数小（3÷4）：商 0 余 3", () => {
    expect(shape(build("3÷4", "remainder"))).toEqual(["shang 0:0", "chu4 0:3", "0:0", "---", "0:3"]);
  });
  test("两位数除数（576÷24）", () => {
    expect(shape(build("576÷24"))[0]).toBe("shang 1:2 0:4");
  });
  test("除数为 0 报错", () => {
    expect(() => build("7÷0")).toThrow(/不能是 0/);
    expect(() => build("7.5÷0")).toThrow(/不能是 0/);
  });
});

describe("孩子的答案", () => {
  test("403−167=346：照写孩子的答案，标出错的百位和十位（正确是 236）", () => {
    const l = build("403-167=346");
    expect(shape(l)[3]).toBe("2:3 1:4 0:6");
    expect(marksOf(l.rows[3])).toEqual([["err"], ["err"], []]);
  });
  test("答案正确时不标错", () => {
    expect(marksOf(build("74+88=162").rows.at(-1))).toEqual([[], [], []]);
  });
  test("43×37=1491：标出错的百位", () => {
    expect(marksOf(build("43×37=1491").rows.at(-1))).toEqual([[], ["err"], [], []]);
  });
  test("写了孩子的答案：默认不画退位点、进位（程序算的过程会被误当成孩子写的）", () => {
    const sub = build("403-167=346");
    expect(marksOf(sub.rows[0]).flat()).not.toContain("tui");
    expect(shape(build("74+88=152"))).toEqual(["1:7 0:4", "+ 1:8 0:8", "---", "2:1 1:5 0:2"]);
  });
  test("写了孩子的答案：乘法不画部分积，除法不画各步", () => {
    expect(shape(build("43×37=1491"))).toEqual(["1:4 0:3", "× 1:3 0:7", "---", "3:1 2:4 1:9 0:1"]);
    expect(shape(build("71÷4=16……7"))).toEqual(["shang 1:1 0:6", "chu4 1:7 0:1", "---", "0:7"]);
    expect(shape(build("71÷4=17", "remainder"))).toEqual(["shang 1:1 0:7", "chu4 1:7 0:1"]);
  });
  test("写了孩子的答案：补的 0 也不画（同样是程序加的）", () => {
    const l = build("30.5-25.21=5.29");
    expect(shape(l)[0]).toBe("1:3 0:0 -0.5:. -1:5");
    expect(marksOf(l.rows[0]).flat()).not.toContain("bu");
    expect(marksOf(build("30.5-25.21=5.29", "process=show").rows[0]).flat()).toContain("bu");
  });
  test("小数部分全是 0 时只划 0，小数点不划（维护者定）", () => {
    const row = build("2.75+3.25").rows.at(-1)!;
    expect(shape(build("2.75+3.25")).at(-1)).toBe("0:6 -0.5:. -1:0 -2:0");
    expect(marksOf(row)).toEqual([[], [], ["hua"], ["hua"]]);
  });
  test("process=show：写了答案也画出正确过程（对照用）", () => {
    const l = build("403-167=346", "process=show");
    expect(marksOf(l.rows[0])).toEqual([["tui"], ["tui"], []]);
    expect(shape(build("71÷4=16……7", "process=show")).length).toBe(8);
  });
  test("process=hide：没写答案也不画过程（出题用）", () => {
    expect(shape(build("74+88", "process=hide"))).toEqual(["1:7 0:4", "+ 1:8 0:8", "---", "2:1 1:6 0:2"]);
  });
  test("process 非法值报错", () => {
    expect(() => parseOptions("process=maybe")).toThrow(/process/);
  });

  test("漏写一位（403−167=36）：在缺的百位补空格子并标错", () => {
    const l = build("403-167=36");
    expect(shape(l)[3]).toBe("2:~ 1:3 0:6");
    expect(marksOf(l.rows[3])).toEqual([["err"], [], []]);
  });
  test("多写一位（74+88=1620）：多出的位与错位的位都标错", () => {
    const marks = marksOf(build("74+88=1620").rows.at(-1));
    expect(marks[0]).toEqual(["err"]);
    expect(marks.some((m, i) => i > 0 && m.includes("err"))).toBe(true);
  });
  test("小数漏写一位（30.5−25.21=5.2）：缺的百分位补空格子并标错", () => {
    const l = build("30.5-25.21=5.2");
    expect(shape(l)[3]).toBe("0:5 -0.5:. -1:2 -2:~");
    expect(marksOf(l.rows[3]).at(-1)).toEqual(["err"]);
  });
  test("商漏写一位（71÷4=7……3）：商的十位补空格子并标错", () => {
    const l = build("71÷4=7……3");
    expect(shape(l)[0]).toBe("shang 1:~ 0:7");
    expect(marksOf(l.rows[0])).toEqual([["err"], []]);
  });
  test("答案数值正确时，即使写法不同也不标（5.290 与 5.29）", () => {
    expect(marksOf(build("30.5-25.21=5.290").rows[3]).flat()).not.toContain("err");
  });
  test("任何数值不对的答案，至少有一位被标出", () => {
    for (const expr of ["403-167=36", "403-167=2360", "74+88=62", "74+88=1162", "43×37=159", "71÷4=1……3", "96÷3=3"]) {
      const l = build(expr);
      const target = expr.includes("÷") ? l.rows[0] : l.rows.at(-1);
      expect(marksOf(target).flat()).toContain("err");
    }
  });

  test("71÷4=16……7：商和余数都标", () => {
    const l = build("71÷4=16……7");
    expect(marksOf(l.rows[0])).toEqual([[], ["err"]]);
    expect(marksOf(l.rows.at(-1))).toEqual([["err"]]);
  });
});
