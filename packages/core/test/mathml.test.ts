import { describe, expect, test } from "bun:test";
import { shushiLayoutToMathML, shushiToMathML } from "../src/index.ts";

/** 极简的 XML 良构检查：标签成对、正确嵌套。 */
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

describe("MathML 导出", () => {
  test("外壳：<math> 带命名空间、display 与朗读文字 alttext", () => {
    const m = shushiToMathML("74+88");
    expect(m.startsWith('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" alttext="竖式：74，加 88，162">')).toBe(true);
    expect(shushiToMathML("74+88", undefined, undefined, { wrap: false }).startsWith("<mstack")).toBe(true);
    expect(shushiToMathML("74+88", undefined, undefined, { display: "inline" })).toContain('display="inline"');
  });

  test("加法（课本写法）：坐在横线上的进位是一行红色小号数字，夹在第二个加数与横线之间", () => {
    const m = shushiToMathML("74+88", undefined, undefined, { wrap: false });
    expect(m).toBe(
      '<mstack stackalign="right">' +
        "<msrow><mn>7</mn><mn>4</mn></msrow>" +
        "<msrow><mo>+</mo><mn>8</mn><mn>8</mn></msrow>" +
        '<msrow><mn mathsize="small" mathcolor="#d4402b">1</mn><mn mathsize="small" mathcolor="#d4402b">1</mn><mrow/></msrow>' +
        "<msline/>" +
        "<msrow><mn>1</mn><mn>6</mn><mn>2</mn></msrow>" +
        "</mstack>",
    );
  });

  test("不用 s / se / ne 方位（polyfill 只正确支持 n）；carries=above 时进位挂在上一行、location=n", () => {
    for (const opts of [undefined, "carryAt=sw", "multiCarry, carryAt=sw"]) {
      expect(shushiToMathML("538×26", opts)).not.toMatch(/location="(s|se|ne)"/);
    }
    const above = shushiToMathML("74+88", undefined, undefined, { carries: "above" });
    expect(above).toContain('<mscarry location="n" crossout="none"><mn mathcolor="#d4402b">1</mn></mscarry>');
    expect(above).not.toContain('mathsize="small"');
  });

  test("减法：退位点是 location=n 的“·”，挂在被减数上", () => {
    const m = shushiToMathML("403-167");
    expect(m).toContain('<mscarry location="n" crossout="none"><mo mathcolor="#d4402b">·</mo></mscarry>');
    expect(m.indexOf("<mscarries")).toBeLessThan(m.indexOf("<msrow><mn>4</mn>"));
  });

  test("小数：小数点占一列；补 0 加框；末尾 0 划掉", () => {
    const sub = shushiToMathML("30.5-25.21");
    expect(sub).toContain("<mn>.</mn>");
    expect(sub).toContain('<menclose notation="box" mathcolor="#d4402b"><mn>0</mn></menclose>');
    expect(shushiToMathML("2.5+1.5")).toContain('<menclose notation="updiagonalstrike"><mn>0</mn></menclose>');
  });

  test("多位乘法：部分积左移，空位补 <mrow/>；第二组进位写在部分积上方", () => {
    const m = shushiToMathML("538×26", "multiCarry");
    expect(m).toContain("<msrow><mn>1</mn><mn>0</mn><mn>7</mn><mn>6</mn><mrow/></msrow>");
    expect(m).toContain('<mscarry location="n" crossout="none"><mn mathcolor="#d4402b">1</mn></mscarry><mrow/><mrow/></mscarries><msrow><mn>1</mn><mn>0</mn><mn>7</mn>');
  });

  test("着色与错误：mathcolor / mathbackground；漏写的位是带底色的空格", () => {
    expect(shushiToMathML("538×26", "colorByDigit")).toContain('<mn mathcolor="#2f6fd6">2</mn>');
    const err = shushiToMathML("403-167=36");
    expect(err).toContain('<mspace width="0.5em" mathbackground="#ffd866"/>');
    expect(shushiToMathML("403-167=346")).toContain('<mn mathbackground="#ffd866">3</mn>');
  });

  test("除法：mlongdiv（除数在左、商在上），子元素依次为除数、商、被除数、各步", () => {
    const m = shushiToMathML("71÷4", undefined, undefined, { wrap: false });
    expect(m).toBe(
      '<mlongdiv longdivstyle="lefttop" stackalign="right">' +
        "<mn>4</mn>" +
        "<msrow><mn>1</mn><mn>7</mn></msrow>" +
        "<msrow><mn>7</mn><mn>1</mn></msrow>" +
        "<msrow><mn>4</mn><mrow/></msrow><msline/>" +
        "<msrow><mn>3</mn><mn>1</mn></msrow>" +
        "<msrow><mn>2</mn><mn>8</mn></msrow><msline/>" +
        "<msrow><mn>3</mn></msrow>" +
        "</mlongdiv>",
    );
  });

  test("直写布局同样能导出，红色强调用 mathcolor", () => {
    expect(shushiLayoutToMathML(String.raw`2 3 \\ \times 4 \\ \hline \hong{1} 2`)).toContain('<mn mathcolor="#d4402b">1</mn>');
  });

  test("所有例子导出的 MathML 都是良构的", () => {
    for (const expr of ["74+88", "403-167", "30.5-25.21", "538×26", "380×3", "23×4", "812÷4", "725÷4", "71÷4=16……7", "3÷4"]) {
      for (const opts of [undefined, "multiCarry, colorByDigit", "mode=expanded, carryAt=sw"]) {
        expect(wellFormed(shushiToMathML(expr, opts))).toBe(true);
      }
    }
  });
});
