import { describe, expect, test } from "bun:test";
import { LayoutSyntaxError, parseLayout, type CarryRow, type DigitRow, type Layout } from "../src/index.ts";

function digits(layout: Layout): string[] {
  return layout.rows.flatMap((r) =>
    r.kind === "digits"
      ? [r.cells.map((c) => (c.content.kind === "digit" ? c.content.text : c.content.kind === "point" ? "." : "~")).join("")]
      : [],
  );
}
function kinds(layout: Layout): string[] {
  return layout.rows.map((r) => r.kind);
}
function digitRow(layout: Layout, n: number): DigitRow {
  const rows = layout.rows.filter((r): r is DigitRow => r.kind === "digits");
  return rows[n]!;
}
function carryRow(layout: Layout, n: number): CarryRow {
  return layout.rows.filter((r): r is CarryRow => r.kind === "carry")[n]!;
}

describe("例 1 加法连续进位 74+88", () => {
  const layout = parseLayout(String.raw`
     7 4 \\
  +  8 8 \\
  \jin{1 1 ~} \\
  \hline
   1 6 2`);

  test("行结构：数字、数字、进位、横线、数字", () => {
    expect(kinds(layout)).toEqual(["digits", "digits", "carry", "hline", "digits"]);
    expect(digits(layout)).toEqual(["74", "88", "162"]);
  });

  test("运算符不占列，记在行上", () => {
    expect(digitRow(layout, 1).operator).toBe("+");
    expect(digitRow(layout, 1).cells.map((c) => c.col)).toEqual([1, 0]);
  });

  test("进位记在进到的那一列，~ 是空格子", () => {
    const carry = carryRow(layout, 0);
    expect(carry.cells.map((c) => [c.col, c.content.kind])).toEqual([
      [2, "digit"],
      [1, "digit"],
      [0, "blank"],
    ]);
  });

  test("按个位右对齐：162 的列号是 2、1、0", () => {
    expect(digitRow(layout, 2).cells.map((c) => c.col)).toEqual([2, 1, 0]);
  });
});

describe("退位点", () => {
  test("例 2：\\tui{1} 6 5", () => {
    const layout = parseLayout(String.raw`\tui{1} 6 5 \\ - 8 4 \\ \hline 8 1`);
    expect(digitRow(layout, 0).cells.map((c) => c.marks)).toEqual([["tui"], [], []]);
    expect(digitRow(layout, 1).operator).toBe("-");
  });

  test("例 4：\\tui{40} 等于每位各打一个点", () => {
    const a = parseLayout(String.raw`\tui{4}\tui{0} 3 \\ - 1 6 7 \\ \hline 2 3 6`);
    const b = parseLayout(String.raw`\tui{40} 3 \\ - 1 6 7 \\ \hline 2 3 6`);
    expect(digitRow(b, 0).cells).toEqual(digitRow(a, 0).cells);
    expect(digitRow(b, 0).cells.map((c) => c.marks)).toEqual([["tui"], ["tui"], []]);
  });

  test("英文别名 \\borrow 等价于 \\tui", () => {
    const a = parseLayout(String.raw`\tui{4} 0 3`);
    const b = parseLayout(String.raw`\borrow{4} 0 3`);
    expect(b).toEqual(a);
  });
});

describe("乘法", () => {
  test("例 5：~ 让第二个部分积左移一位", () => {
    const layout = parseLayout(String.raw`4 3 \\ \times 3 7 \\ \hline 3 0 1 \\ 1 2 9 ~ \\ \hline 1 5 9 1`);
    expect(digitRow(layout, 1).operator).toBe("×");
    const second = digitRow(layout, 3);
    expect(second.cells.map((c) => c.col)).toEqual([3, 2, 1, 0]);
    expect(second.cells[3]!.content.kind).toBe("blank");
  });

  test("例 6：\\textcolor 包住进位行，颜色落到每个进位格", () => {
    const layout = parseLayout(String.raw`
      5 3 8 \\ \times 2 6 \\
      \textcolor{red}{\jin{2 4 ~}} \\ \hline
      \textcolor{red}{3 2 2 8} \\
      \textcolor{blue}{\jin{1 ~ ~}} \\
      \textcolor{blue}{1 0 7 6 ~} \\ \hline
      1 3 9 8 8`);
    expect(kinds(layout)).toEqual(["digits", "digits", "carry", "hline", "digits", "carry", "digits", "hline", "digits"]);
    expect(carryRow(layout, 0).cells.every((c) => c.color === "red")).toBe(true);
    expect(carryRow(layout, 1).cells.map((c) => c.col)).toEqual([2, 1, 0]);
    expect(digitRow(layout, 3).cells.every((c) => c.color === "blue")).toBe(true);
  });

  test("例 8：\\hong 红色强调", () => {
    const layout = parseLayout(String.raw`2 3 \\ \times 4 \\ \hline \hong{1} 2 \\ 8 0 \\ \hline 9 2`);
    expect(digitRow(layout, 2).cells[0]!.marks).toEqual(["hong"]);
  });
});

describe("例 9 长除法 71÷4", () => {
  const layout = parseLayout(String.raw`
    \shang 1 7 \\
    \chu{4} 7 1 \\
    4 ~ \\ \hline
    3 1 \\
    2 8 \\ \hline
    3`);

  test("商行与被除数行", () => {
    expect(digitRow(layout, 0).quotient).toBe(true);
    expect(digitRow(layout, 1).divisor).toBe("4");
    expect(digits(layout)).toEqual(["17", "71", "4~", "31", "28", "3"]);
  });

  test("4 ~ 让 4 落在十位", () => {
    expect(digitRow(layout, 2).cells[0]!.col).toBe(1);
  });
});

describe("小数", () => {
  test("例 10：小数点占 -0.5 列，按小数点对齐", () => {
    const layout = parseLayout(String.raw`24.5 \\ + 16.3 \\ \hline 40.8`);
    expect(layout.hasDecimal).toBe(true);
    expect(digitRow(layout, 0).cells.map((c) => c.col)).toEqual([1, 0, -0.5, -1]);
  });

  test("例 11：\\bu{0} 补 0，位数不同也按小数点对齐", () => {
    const layout = parseLayout(String.raw`30.5\bu{0} \\ - 25.21 \\ \hline 5.29`);
    const top = digitRow(layout, 0).cells;
    expect(top.map((c) => c.col)).toEqual([1, 0, -0.5, -1, -2]);
    expect(top[4]!.marks).toEqual(["bu"]);
    expect(digitRow(layout, 2).cells.map((c) => c.col)).toEqual([0, -0.5, -1, -2]);
  });
});

describe("例 12 孩子的错误过程", () => {
  test("\\err 标出错的一位，不校验对错", () => {
    const layout = parseLayout(String.raw`\tui{4} 0 3 \\ - 1 6 7 \\ \hline \err{3} 4 6`);
    expect(digitRow(layout, 2).cells.map((c) => c.marks)).toEqual([["err"], [], []]);
  });
});

describe("报错", () => {
  const bad: [string, string, RegExp][] = [
    ["运算符写在中间", String.raw`7 + 4`, /开头/],
    ["& 分格属第三期", String.raw`1 & 3`, /第三期/],
    ["花括号不配对", String.raw`\tui{4 0 3`, /配对/],
    ["不认识的命令", String.raw`\foo{1}`, /不认识的命令/],
    ["两个小数点", String.raw`1.2.3`, /两个小数点/],
    ["进位行里有运算符", String.raw`\jin{+1}`, /进位行/],
    ["\\hline 写在行中间", String.raw`7 4 \hline`, /单独放/],
    ["只有横线", String.raw`\hline`, /至少要有一行数字/],
    ["颜色里夹带怪字符", String.raw`\textcolor{red" onload="x}{1}`, /颜色/],
    ["除数不是数字", String.raw`\chu{a} 7 1`, /除数/],
  ];
  for (const [name, source, message] of bad) {
    test(name, () => {
      expect(() => parseLayout(source)).toThrow(LayoutSyntaxError);
      expect(() => parseLayout(source)).toThrow(message);
    });
  }
});
