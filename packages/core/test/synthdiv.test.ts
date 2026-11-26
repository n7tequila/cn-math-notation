import { describe, expect, test } from "bun:test";
import {
  ExpressionError,
  LayoutSyntaxError,
  OptionError,
  buildSynthDiv,
  parseSynthDivLayout,
  renderZonghe,
  renderZongheLayout,
  type SynthDivLayout,
} from "../src/index.ts";

const row = (cells: readonly ({ text: string } | undefined)[]): string => cells.map((c) => c?.text ?? "~").join(" ");

/** 写成 "根 | 系数 / 乘积 / 结果"。 */
function shape(l: SynthDivLayout): string {
  return `${l.root.text} | ${row(l.top)} / ${row(l.middle)} / ${row(l.bottom)}`;
}

describe("综合除法语义式", () => {
  test("除以 x+1：根写 −1，最后一格是余数", () => {
    expect(shape(buildSynthDiv(String.raw`(x^2+3x+2)\div(x+1)`))).toBe("−1 | 1 3 2 / ~ −1 −2 / 1 2 0");
  });

  test("缺项系数写 0；除不尽时最后一格是余数", () => {
    expect(shape(buildSynthDiv("(x^3-1)÷(x-1)"))).toBe("1 | 1 0 0 −1 / ~ 1 1 1 / 1 1 1 0");
    expect(shape(buildSynthDiv("(2x^3-3x+5)÷(x-2)"))).toBe("2 | 2 0 −3 5 / ~ 4 8 10 / 2 4 5 15");
  });

  test("result：写出商与余数", () => {
    expect(buildSynthDiv("(x^3-1)÷(x-1)", "result").result).toEqual(["商 x² + x + 1，余数 0"]);
    expect(buildSynthDiv("(2x^3-3x+5)÷(x-2)", "result").result).toEqual(["商 2x² + 4x + 5，余数 15"]);
    expect(buildSynthDiv("(x^2+3x+2)÷(x+1)").result).toEqual([]);
  });

  test("problem（默认开）：上方写原题；problem=false 不写；直写没有原题", () => {
    expect(buildSynthDiv(String.raw`(x^2+3x+2)\div(x+1)`).problem).toBe("(x² + 3x + 2) ÷ (x + 1)");
    expect(buildSynthDiv("(2x^3-3x+5)÷(x-2)").problem).toBe("(2x³ − 3x + 5) ÷ (x − 2)");
    expect(buildSynthDiv("(x^3-1)÷(x-1)", "problem=false").problem).toBeUndefined();
    expect(parseSynthDivLayout(String.raw`-1 | 1 & 3 & 2 \\ & -1 & -2 \\ 1 & 2 & 0`).problem).toBeUndefined();
  });

  test("不能用综合除法的报错", () => {
    expect(() => buildSynthDiv("(x^2+1)÷(2x+1)")).toThrow(/x − a/);
    expect(() => buildSynthDiv("(x^3+1)÷(x^2+1)")).toThrow(/x − a/);
    expect(() => buildSynthDiv("(x^2+1)(x+1)")).toThrow(ExpressionError);
    expect(() => buildSynthDiv("(x^2+1)÷(x+1)", "foo")).toThrow(OptionError);
  });
});

describe("综合除法直写", () => {
  test("三行：根 | 系数、乘积（第一格空）、结果（最后一格是余数）", () => {
    const l = parseSynthDivLayout(String.raw`-1 | 1 & 3 & 2 \\ & -1 & -2 \\ 1 & 2 & 0`);
    expect(shape(l)).toBe("−1 | 1 3 2 / ~ −1 −2 / 1 2 0");
  });

  test("\\err 标出算错的格", () => {
    const l = parseSynthDivLayout(String.raw`-1 | 1 & 3 & 2 \\ & -1 & -2 \\ 1 & \err{4} & 0`);
    expect(l.bottom[1]!.marks).toEqual(["err"]);
  });

  test("写法错误报错", () => {
    expect(() => parseSynthDivLayout(String.raw`1 & 3 & 2 \\ & -1 & -2 \\ 1 & 2 & 0`)).toThrow(/根/);
    expect(() => parseSynthDivLayout(String.raw`-1 | 1 & 3 & 2 \\ 1 & 2 & 0`)).toThrow(/三行/);
    expect(() => parseSynthDivLayout(String.raw`-1 | 1 & 3 & 2 \\ & -1 \\ 1 & 2 & 0 & 5`)).toThrow(LayoutSyntaxError);
    expect(() => parseSynthDivLayout(String.raw`-1 | 1 & x & 2 \\ & -1 & -2 \\ 1 & 2 & 0`)).toThrow(LayoutSyntaxError);
  });
});

describe("综合除法渲染", () => {
  test("根后一条竖线、横线，余数前一条短竖线；朗读文字", () => {
    const { svg, label } = renderZonghe(String.raw`(x^2+3x+2)\div(x+1)`);
    expect(svg).toContain('class="cmn-zh-v"');
    expect(svg).toContain('class="cmn-zh-h"');
    expect(svg).toContain('class="cmn-zh-rem"');
    expect(label).toBe("综合除法：(x² + 3x + 2) ÷ (x + 1)；−1，系数 1、3、2；乘得 −1、−2；得 1、2，余数 0");
    expect(svg).toContain('class="cmn-problem"');
    expect(renderZonghe(String.raw`(x^2+3x+2)\div(x+1)`, "problem=false").svg).not.toContain("cmn-problem");
  });

  test("result 写在下面；直写的错误标记画出底色；直写不接受选项", () => {
    expect(renderZonghe("(x^3-1)÷(x-1)", "result").svg).toContain("余数 0");
    expect(renderZongheLayout(String.raw`-1 | 1 & 3 & 2 \\ & -1 & -2 \\ 1 & \err{4} & 0`).svg).toContain("cmn-err");
    expect(() => renderZongheLayout(String.raw`-1 | 1 & 3 & 2 \\ & -1 & -2 \\ 1 & 2 & 0`, "result")).toThrow(OptionError);
  });
});
