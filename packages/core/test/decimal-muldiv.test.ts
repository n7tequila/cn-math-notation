import { describe, expect, test } from "bun:test";
import {
  DEFAULT_STYLE,
  buildSemantic,
  layoutToMathML,
  parseLayout,
  parseOptions,
  renderLayout,
  toGapPoints,
  type Cell,
  type Layout,
  type Row,
} from "../src/index.ts";

const style = (opts?: string) => parseOptions(opts, DEFAULT_STYLE);
const build = (expr: string, opts?: string) => buildSemantic(expr, style(opts));

const POINT_GLYPH = { dot: ".", hong: "!", hua: "/" } as const;

/** 一行写成“数字串@最低列”：小数点写在空隙里，. 普通、! 标红、/ 划掉；~ 为空格子。 */
function text(cells: readonly Cell[]): string {
  const sorted = [...cells].sort((a, b) => b.col - a.col);
  const body = sorted
    .map((c) => {
      const ch = c.content.kind === "digit" ? c.content.text : c.content.kind === "point" ? "(P)" : "~";
      return ch + (c.point === undefined ? "" : POINT_GLYPH[c.point]);
    })
    .join("");
  return `${body}@${sorted[sorted.length - 1]!.col}`;
}

function shape(layout: Layout): string[] {
  return layout.rows.map((r: Row) => {
    if (r.kind === "hline") return "---";
    if (r.kind === "carry") return `jin ${r.cells.map((c) => `${c.col}:${c.content.kind === "digit" ? c.content.text : ""}`).join(" ")}`;
    const tag = r.quotient ? "shang " : "";
    const op = r.operator !== undefined ? `${r.operator} ` : "";
    const div =
      r.divisor !== undefined
        ? `chu${r.divisorStruckPoint === undefined ? r.divisor : r.divisor.slice(0, r.divisorStruckPoint) + "/" + r.divisor.slice(r.divisorStruckPoint)} `
        : "";
    return `${tag}${op}${div}${text(r.cells)}`;
  });
}

function marks(row: Row | undefined): string[][] {
  return row !== undefined && row.kind !== "hline" ? row.cells.map((c) => [...c.marks]) : [];
}

describe("小数乘法（样本 4.1×3.2、6.9×3、4.2×20）", () => {
  test("4.1×3.2：末位对齐，部分积不点小数点，积上点小数点且不占列", () => {
    const layout = build("4.1×3.2");
    expect(shape(layout)).toEqual(["4.1@0", "× 3.2@0", "---", "82@0", "123@1", "---", "13.12@0"]);
    expect(layout.hasDecimal).toBe(false);
  });

  test("6.9×3：一位数乘照样画进位，carry=false 可关", () => {
    expect(shape(build("6.9×3"))).toEqual(["6.9@0", "× 3@0", "jin 1:2", "---", "20.7@0"]);
    expect(shape(build("6.9×3", "carry=false"))).toEqual(["6.9@0", "× 3@0", "---", "20.7@0"]);
  });

  test("4.2×20：整数因数末尾的 0 甩在外面，积末尾的 0 划掉、小数点不划", () => {
    const layout = build("4.2×20");
    expect(shape(layout)).toEqual(["4.2@1", "× 20@0", "---", "84.0@0"]);
    expect(marks(layout.rows.at(-1))).toEqual([[], [], ["hua"]]);
  });

  test("markPoint：积的小数点标红", () => {
    expect(shape(build("4.2×20", "markPoint")).at(-1)).toBe("84!0@0");
  });

  test("1.25×4=5.00：两个 0 都划掉，进位照画", () => {
    const layout = build("1.25×4");
    expect(shape(layout)).toEqual(["1.25@0", "× 4@0", "jin 2:1 1:2", "---", "5.00@0"]);
    expect(marks(layout.rows.at(-1))).toEqual([[], ["hua"], ["hua"]]);
  });

  test("0.12×0.3：积前面位数不够补 0，写成 0.036，补的 0 不加框", () => {
    const layout = build("0.12×0.3");
    expect(shape(layout)).toEqual(["0.12@0", "× 0.3@0", "---", "0.036@0"]);
    expect(marks(layout.rows.at(-1))).toEqual([[], [], [], []]);
  });

  test("多位数乘 multiCarry 也照整数规则画进位", () => {
    expect(shape(build("2.7×1.6", "multiCarry"))).toEqual([
      "2.7@0",
      "× 1.6@0",
      "jin 1:4",
      "---",
      "162@0",
      "27@1",
      "---",
      "4.32@0",
    ]);
  });

  test("小数因数末尾有 0（3.50×12，维护者 2026-11-27）：0 甩在外面，按 35×12 算，积 42.00 末尾的 0 划掉", () => {
    const layout = build("3.50×12");
    expect(shape(layout)).toEqual(["3.50@0", "× 12@1", "---", "70@1", "35@2", "---", "42.00@0"]);
    expect(marks(layout.rows.at(-1))).toEqual([[], [], ["hua"], ["hua"]]);
  });

  test("小数因数末尾有 0 的其他情形：乘数一侧、一位数乘、两个都有、因数是 0.0", () => {
    expect(shape(build("12×3.50")).slice(0, 2)).toEqual(["12@1", "× 3.50@0"]);
    expect(shape(build("0.50×3"))).toEqual(["0.50@0", "× 3@1", "---", "1.50@0"]);
    expect(shape(build("0.20×30")).slice(0, 2)).toEqual(["0.20@1", "× 30@1"]);
    expect(shape(build("0.20×30")).at(-1)).toBe("6.00@0");
    expect(shape(build("0.0×3")).at(-1)).toBe("0.0@0");
  });

  test("孩子的答案省略末尾的 0 不判错", () => {
    const layout = build("3.50×12=42");
    expect(marks(layout.rows.at(-1)).flat()).not.toContain("err");
  });

  test("孩子的答案 4.1×3.2=13.2：只写答案，错位与漏位标错", () => {
    const layout = build("4.1×3.2=13.2");
    expect(shape(layout)).toEqual(["4.1@0", "× 3.2@0", "---", "13.2~@0"]);
    expect(marks(layout.rows.at(-1))).toEqual([[], [], ["err"], ["err"]]);
  });
});

describe("小数除法（样本 15.6÷6、5.8÷4、12÷50、6.78÷1.2）", () => {
  test("15.6÷6：商的小数点与被除数的小数点对齐", () => {
    expect(shape(build("15.6÷6"))).toEqual([
      "shang 2.6@0",
      "chu6 15.6@0",
      "12@1",
      "---",
      "36@0",
      "36@0",
      "---",
      "0@0",
    ]);
  });

  test("5.8÷4：添的 0 写在余数行，不补进被除数", () => {
    expect(shape(build("5.8÷4"))).toEqual([
      "shang 1.45@-1",
      "chu4 5.8@0",
      "4@1",
      "---",
      "18@0",
      "16@0",
      "---",
      "20@-1",
      "20@-1",
      "---",
      "0@-1",
    ]);
  });

  test("markAppended：添的 0 与对应的商位标红（默认不标）", () => {
    const plain = build("5.8÷4");
    expect(marks(plain.rows[0])).toEqual([[], [], []]);
    const marked = build("5.8÷4", "markAppended");
    expect(marks(marked.rows[0])).toEqual([[], [], ["hong"]]);
    expect(marks(marked.rows[7])).toEqual([[], ["hong"]]); // 余数行 20 的 0
    expect(marks(marked.rows[8])).toEqual([[], []]); // 乘积 20 不标
  });

  test("整数除以整数默认除成小数：12÷50 写成 12.0，商 0.24；remainder 时写余数", () => {
    expect(shape(build("12÷50", "remainder"))[0]).toBe("shang 0@0");
    expect(shape(build("12÷50"))).toEqual([
      "shang 0.24@-1",
      "chu50 12.0@0",
      "100@0",
      "---",
      "200@-1",
      "200@-1",
      "---",
      "0@-1",
    ]);
  });

  test("0.12÷4：商的整数部分和前面的小数位补 0", () => {
    expect(shape(build("0.12÷4"))).toEqual(["shang 0.03@0", "chu4 0.12@0", "12@0", "---", "0@0"]);
  });

  test("6.78÷1.2：除数、被除数原来的小数点划掉，按新小数点除", () => {
    expect(shape(build("6.78÷1.2"))).toEqual([
      "shang 5.65@-1",
      "chu1/2 6/7.8@0",
      "60@1",
      "---",
      "78@0",
      "72@0",
      "---",
      "60@-1",
      "60@-1",
      "---",
      "0@-1",
    ]);
  });

  test("6÷0.25：被除数位数不够，补的 0 加框【推论】", () => {
    const layout = build("6÷0.25");
    expect(shape(layout)).toEqual([
      "shang 24@0",
      "chu0/25 600@0",
      "50@1",
      "---",
      "100@0",
      "100@0",
      "---",
      "0@0",
    ]);
    expect(marks(layout.rows[1])).toEqual([[], ["bu"], ["bu"]]);
  });

  test("除不尽先报错", () => {
    expect(() => build("7÷3")).toThrow(/除不尽/);
    expect(shape(build("7÷3", "remainder"))[0]).toBe("shang 2@0");
    expect(shape(build("71÷4=17……3"))[0]).toBe("shang 17@0"); // 写了余数自动按余数画
    expect(() => build("7.5÷0.7")).toThrow(/除不尽/);
  });

  test("孩子的答案 15.6÷6=2.5：只写商与被除数，错位标错；小数除法不能写余数", () => {
    const layout = build("15.6÷6=2.5");
    expect(shape(layout)).toEqual(["shang 2.5@0", "chu6 15.6@0"]);
    expect(marks(layout.rows[0])).toEqual([[], ["err"]]);
    expect(() => build("15.6÷6=2……0.6")).toThrow(/余数/);
  });
});

describe("空隙小数点的渲染与导出", () => {
  test("SVG：小数点画在两格之间，划掉的小数点带红色斜线", () => {
    const svg = renderLayout(build("6.78÷1.2"), style()).svg;
    expect(svg).toContain('class="cmn-dian"');
    expect(svg).toContain('class="cmn-dian-hua"');
  });

  test("MathML：小数点与前一位同格，不另占一列；划掉的小数点用 updiagonalstrike", () => {
    const m1 = layoutToMathML(build("4.1×3.2"));
    expect(m1).toContain("<mrow><mn>4</mn><mn>.</mn></mrow>");
    const m2 = layoutToMathML(build("6.78÷1.2"));
    expect(m2).toContain('<menclose notation="updiagonalstrike"><mn>.</mn></menclose>');
  });
});

describe("加减法的小数点（维护者 2026-11-26 定：默认不占列，pointColumn 可恢复占列）", () => {
  test("24.5+16.3：默认 SVG 里小数点写在空隙里，没有小数点那条窄列", () => {
    const layout = build("24.5+16.3");
    const svg = renderLayout(layout, style()).svg;
    expect(svg).toContain('class="cmn-dian"');
    const old = renderLayout(layout, style("pointColumn")).svg;
    expect(old).not.toContain('class="cmn-dian"');
    expect(renderLayout(layout, style()).width).toBeLessThan(renderLayout(layout, style("pointColumn")).width);
  });

  test("toGapPoints：整数列整体右移小数位数，小数点并到个位那一格", () => {
    const gap = toGapPoints(build("30.5-25.21"));
    expect(shape(gap)).toEqual(["30.50@0", "- 25.21@0", "---", "5.29@0"]);
    expect(gap.hasDecimal).toBe(false);
  });

  test("直写布局 .5（没有个位）也能放小数点", () => {
    const gap = toGapPoints(parseLayout(String.raw`1.5 \\ + .5 \\ \hline 2.0`));
    expect(shape(gap)).toEqual(["1.5@0", "+ ~.5@0", "---", "2.0@0"]);
  });

  test("MathML 默认同格，pointColumn 时小数点占一列", () => {
    const layout = build("24.5+16.3");
    expect(layoutToMathML(layout, style())).toContain("<mrow><mn>4</mn><mn>.</mn></mrow>");
    expect(layoutToMathML(layout, style("pointColumn"))).toContain("<mn>4</mn><mn>.</mn><mn>5</mn>");
  });
});
