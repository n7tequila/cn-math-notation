import { describe, expect, test } from "bun:test";
import {
  buildSemantic,
  DEFAULT_STYLE,
  ExpressionError,
  LayoutSyntaxError,
  renderShizi,
  renderShushi,
  renderShushiLayout,
  translateFormula,
} from "../src/index.ts";
import { escapeXml } from "../src/xml.ts";

// 2026-11-27 全量代码审查发现的问题，修之前都能复现。

describe("直写布局的输入不能往 SVG 里塞属性", () => {
  test("多项式竖式 \\chu{…} 的除数也要校验字符", () => {
    expect(() => renderShushiLayout('\\chu{1"onmouseover="alert(1)} & x^2 & +1')).toThrow(LayoutSyntaxError);
    expect(() => renderShushiLayout("\\chu{x+1} & x^2 & +3x & +2")).not.toThrow();
  });

  test("escapeXml 转义属性和文字里的特殊字符", () => {
    expect(escapeXml(`a"b<c>d&e'f`)).toBe("a&quot;b&lt;c&gt;d&amp;e&#39;f");
  });

  test("朗读文字写进 aria-label 前要转义", () => {
    const svg = renderShushiLayout("\\chu{x+1} & x^2 & +3x & +2").svg;
    const label = /aria-label="([^"]*)"/.exec(svg)?.[1] ?? "";
    expect(label).not.toMatch(/[<>]/);
  });
});

describe("太大的输入直接报错，不卡住渲染", () => {
  test("十字相乘的系数有上限", () => {
    const start = performance.now();
    expect(() => renderShizi("x^2+x+100000000007")).toThrow(ExpressionError);
    expect(performance.now() - start).toBeLessThan(100);
  });

  test("多项式的次数有上限", () => {
    const start = performance.now();
    expect(() => renderShushi("(x^30000)(x^30000+1)")).toThrow(ExpressionError);
    expect(performance.now() - start).toBeLessThan(100);
    expect(() => renderShushi("(x^5+1)(x^3-x)")).not.toThrow();
  });
});

describe("算术里的字母写法不被当成多项式", () => {
  test("余数写成 r（文档里写的 16r7）", () => {
    expect(renderShushi("71\\div4=17r3").label).toBe(renderShushi("71\\div4=17……3").label);
  });

  test("乘号写成 x", () => {
    expect(renderShushi("43x37").label).toBe(renderShushi("43\\times37").label);
  });

  test("真正的多项式照常", () => {
    expect(() => renderShushi("(x+1)(x+2)")).not.toThrow();
  });
});

describe("加减法：答案省略末尾的 0 不算错", () => {
  const errorCells = (source: string) =>
    buildSemantic(source, DEFAULT_STYLE)
      .rows.flatMap((r) => (r.kind === "hline" ? [] : r.cells))
      .filter((c) => c.marks.includes("err"));
  test("1.25+3.35=4.6、2.5+2.5=5", () => {
    expect(errorCells("1.25+3.35=4.6")).toEqual([]);
    expect(errorCells("2.5+2.5=5")).toEqual([]);
  });
  test("真写错了照样标错", () => {
    expect(errorCells("1.25+3.35=4.7").length).toBeGreaterThan(0);
  });
});

describe("默认（空隙小数点）写法保留小数点上的标记和颜色", () => {
  test("\\hua{.} 画成划掉的小数点", () => {
    expect(renderShushiLayout("12\\hua{.}5 \\\\ \\hline 3.0").svg).not.toBe(renderShushiLayout("12.5 \\\\ \\hline 3.0").svg);
  });
  test("\\textcolor 的颜色留在小数点上", () => {
    expect(renderShushiLayout("12.5 \\\\ \\hline 3\\textcolor{blue}{.}0").svg).toContain("blue");
  });
  test("\\err{.} 标红", () => {
    expect(renderShushiLayout("12\\err{.}5").svg).not.toBe(renderShushiLayout("12.5").svg);
  });
});

describe("报错里的命令名用用户写的那个", () => {
  test("英文别名", () => {
    const r = translateFormula("\\vertical*{7 + 4}");
    expect(r.kind === "error" && r.message.startsWith("\\vertical*：")).toBe(true);
    const s = translateFormula("\\crossmul{x^2+1}");
    expect(s.kind === "error" && s.message.startsWith("\\crossmul：")).toBe(true);
  });
});
