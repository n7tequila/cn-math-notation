import { describe, expect, test } from "bun:test";
import {
  ExpressionError,
  LayoutSyntaxError,
  OptionError,
  buildCrossMul,
  parseCrossMulLayout,
  renderShizi,
  renderShiziLayout,
  type CrossMulLayout,
} from "../src/index.ts";

/** 写成 "左上 右上 / 左下 右下 | 验算"。 */
function shape(l: CrossMulLayout): string {
  const check = l.check === undefined ? "" : ` | ${l.check.text}`;
  return `${l.left[0].text} ${l.right[0].text} / ${l.left[1].text} ${l.right[1].text}${check}`;
}

describe("十字相乘语义式", () => {
  test("二次项系数为 1：x²+5x+6", () => {
    expect(shape(buildCrossMul("x^2+5x+6"))).toBe("x +2 / x +3 | 3x + 2x = 5x");
    expect(shape(buildCrossMul("x²+5x+6"))).toBe(shape(buildCrossMul("x^{2} + 5x + 6")));
  });

  test("常数项为负：x²−x−6", () => {
    expect(shape(buildCrossMul("x^2-x-6"))).toBe("x +2 / x −3 | −3x + 2x = −x");
  });

  test("二次项系数不为 1：6x²−7x−3", () => {
    expect(shape(buildCrossMul("6x^2-7x-3"))).toBe("2x −3 / 3x +1 | 2x − 9x = −7x");
  });

  test("两个字母：x²+5xy+6y²", () => {
    expect(shape(buildCrossMul("x^2+5xy+6y^2"))).toBe("x +2y / x +3y | 3xy + 2xy = 5xy");
  });

  test("没有一次项：x²−9", () => {
    expect(shape(buildCrossMul("x^2-9"))).toBe("x +3 / x −3 | −3x + 3x = 0");
  });

  test("check=false 不写验算行；result 写出分解结果", () => {
    expect(buildCrossMul("x^2+5x+6", "check=false").check).toBeUndefined();
    expect(buildCrossMul("x^2+5x+6", "result").result).toEqual(["x² + 5x + 6 = (x + 2)(x + 3)"]);
    expect(buildCrossMul("6x^2-7x-3", "result").result).toEqual(["6x² − 7x − 3 = (2x − 3)(3x + 1)"]);
    expect(buildCrossMul("x^2+5xy+6y^2", "result").result).toEqual(["x² + 5xy + 6y² = (x + 2y)(x + 3y)"]);
  });

  test("不能用十字相乘的报错", () => {
    expect(() => buildCrossMul("x^2+x+1")).toThrow(/整数范围内/);
    expect(() => buildCrossMul("2x^2+4x+2")).toThrow(/公因式/);
    expect(() => buildCrossMul("-x^2+5x-6")).toThrow(/负/);
    expect(() => buildCrossMul("x+1")).toThrow(ExpressionError);
    expect(() => buildCrossMul("x^3+1")).toThrow(ExpressionError);
    expect(() => buildCrossMul("x^2+5x+6", "foo")).toThrow(OptionError);
  });
});

describe("十字相乘直写", () => {
  test("两行四个角，可选第三行验算", () => {
    expect(shape(parseCrossMulLayout(String.raw`x & +2 \\ x & +3`))).toBe("x +2 / x +3");
    expect(shape(parseCrossMulLayout(String.raw`x & +2 \\ x & +3 \\ 3x+2x=5x`))).toBe("x +2 / x +3 | 3x+2x=5x");
  });

  test("\\err 标出写错的角", () => {
    const l = parseCrossMulLayout(String.raw`x & +2 \\ x & \err{-3}`);
    expect(l.right[1].marks).toEqual(["err"]);
    expect(l.right[1].text).toBe("−3");
  });

  test("写法错误报错", () => {
    expect(() => parseCrossMulLayout(String.raw`x & +2`)).toThrow(LayoutSyntaxError);
    expect(() => parseCrossMulLayout(String.raw`x +2 \\ x & +3`)).toThrow(LayoutSyntaxError);
    expect(() => parseCrossMulLayout(String.raw`x & \frac{1}{2} \\ x & +3`)).toThrow(LayoutSyntaxError);
  });
});

describe("十字相乘渲染", () => {
  test("两条交叉斜线；有验算行时画横线；字母斜体", () => {
    const { svg, label } = renderShizi("x^2+5x+6");
    expect((svg.match(/class="cmn-cross-line"/g) ?? []).length).toBe(2);
    expect(svg).toContain('class="cmn-cross-rule"');
    expect(svg).toContain('font-style="italic"');
    expect(label).toBe("十字相乘：x 与 +2，x 与 +3；3x + 2x = 5x");
    expect(renderShizi("x^2+5x+6", "check=false").svg).not.toContain("cmn-cross-rule");
  });

  test("result 写在下面；直写的错误标记画出底色；直写不接受 result", () => {
    expect(renderShizi("x^2+5x+6", "result").label).toContain("(x + 2)(x + 3)");
    expect(renderShiziLayout(String.raw`x & +2 \\ x & \err{-3}`).svg).toContain("cmn-err");
    expect(() => renderShiziLayout(String.raw`x & +2 \\ x & +3`, "result")).toThrow(OptionError);
  });
});
