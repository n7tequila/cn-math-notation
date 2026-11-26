import { describe, expect, test } from "bun:test";
import {
  ExpressionError,
  LayoutSyntaxError,
  OptionError,
  buildShortDiv,
  parseShortDivLayout,
  renderDuanchu,
  renderDuanchuLayout,
  type ShortDivLayout,
} from "../src/index.ts";

/** 每行写成“除数|数 数”，最后一行只有商。 */
function shape(layout: ShortDivLayout): string[] {
  return layout.rows.map((r) => {
    const values = r.values.map((v) => v.text).join(" ");
    return r.divisor === undefined ? values : `${r.divisor.text}|${values}`;
  });
}

describe("短除法语义式", () => {
  test("分解质因数 36：除到商是质数", () => {
    const l = buildShortDiv("36");
    expect(shape(l)).toEqual(["2|36", "2|18", "3|9", "3"]);
    expect(l.result).toEqual([]);
  });

  test("两个数 36、48：用公有的质因数从小到大除，除到互质", () => {
    expect(shape(buildShortDiv("36, 48"))).toEqual(["2|36 48", "2|18 24", "3|9 12", "3 4"]);
    expect(shape(buildShortDiv("36 48"))).toEqual(shape(buildShortDiv("36，48")));
  });

  test("三个数 4、6、9：能整除其中两个就除，除不尽的原样落下", () => {
    expect(shape(buildShortDiv("4, 6, 9"))).toEqual(["2|4 6 9", "3|2 3 9", "2 1 3"]);
  });

  test("result：写出结果算式", () => {
    expect(buildShortDiv("36", "result").result).toEqual(["36 = 2×2×3×3"]);
    expect(buildShortDiv("36, 48", "result").result).toEqual(["(36, 48) = 2×2×3 = 12", "[36, 48] = 2×2×3×3×4 = 144"]);
    expect(buildShortDiv("6, 9", "result").result).toEqual(["(6, 9) = 3", "[6, 9] = 3×2×3 = 18"]);
    expect(buildShortDiv("4, 6, 9", "result").result).toEqual(["[4, 6, 9] = 2×3×2×3 = 36"]);
  });

  test("不能列短除法的情况报错", () => {
    expect(() => buildShortDiv("37")).toThrow(/质数/);
    expect(() => buildShortDiv("1")).toThrow(ExpressionError);
    expect(() => buildShortDiv("8, 9")).toThrow(/互质/);
    expect(() => buildShortDiv("5, 7, 11")).toThrow(/互质/);
    expect(() => buildShortDiv("2, 4, 6, 8")).toThrow(/三个/);
    expect(() => buildShortDiv("12, a")).toThrow(ExpressionError);
    expect(() => buildShortDiv("36", "foo")).toThrow(OptionError);
  });
});

describe("短除法直写", () => {
  test("逐行写除数和数，最后一行只写商", () => {
    const l = parseShortDivLayout(String.raw`6 | 36 48 \\ 2 | 6 8 \\ 3 4`);
    expect(shape(l)).toEqual(["6|36 48", "2|6 8", "3 4"]);
  });

  test("\\err、\\hong 标出整个数", () => {
    const l = parseShortDivLayout(String.raw`2 | 36 48 \\ 2 | \err{17} 24 \\ \hong{3} | 9 12 \\ 3 4`);
    expect(l.rows[1]!.values[0]!.marks).toEqual(["err"]);
    expect(l.rows[2]!.divisor!.marks).toEqual(["hong"]);
  });

  test("写法错误报错", () => {
    expect(() => parseShortDivLayout(String.raw`2 | 36 | 48`)).toThrow(LayoutSyntaxError);
    expect(() => parseShortDivLayout(String.raw`2 | x`)).toThrow(LayoutSyntaxError);
    expect(() => parseShortDivLayout("")).toThrow(LayoutSyntaxError);
  });
});

describe("短除法渲染", () => {
  test("每个除数一条竖线一条横线，最后一行没有线；数按个位对齐", () => {
    const { svg, label } = renderDuanchu("36, 48");
    expect((svg.match(/class="cmn-dc-v"/g) ?? []).length).toBe(3);
    expect((svg.match(/class="cmn-dc-h"/g) ?? []).length).toBe(3);
    expect(label).toBe("短除法：2 除 36、48，2 除 18、24，3 除 9、12，最后得 3、4");
  });

  test("result 时下面多出结果算式", () => {
    expect(renderDuanchu("36", "result").svg).toContain("36 = 2×2×3×3");
    expect(renderDuanchu("36").svg).not.toContain("36 = 2");
  });

  test("直写的错误标记画出底色", () => {
    expect(renderDuanchuLayout(String.raw`2 | \err{17} \\ 17`).svg).toContain("cmn-err");
  });
});
