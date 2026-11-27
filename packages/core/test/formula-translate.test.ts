import { describe, expect, test } from "bun:test";
import { buildDengshi, translateFormula, translateFormulaMathML } from "../src/index.ts";

describe("translateFormula：公式文本 → 本库 SVG / 递等式 TeX / 放行 / 报错", () => {
  test("普通公式放行", () => {
    expect(translateFormula("x^2")).toEqual({ kind: "pass" });
  });

  test("竖式语义式画成 SVG，带朗读文字", () => {
    const r = translateFormula(String.raw`\shushi{74+88}`);
    expect(r.kind).toBe("svg");
    if (r.kind === "svg") {
      expect(r.rendered.svg.startsWith("<svg")).toBe(true);
      expect(r.rendered.label).toBe("竖式：74，加 88，162");
    }
  });

  test("竖式直写、短除法、树状图、十字相乘、综合除法都画成 SVG", () => {
    const cases = [
      String.raw`\shushi*{7 4 \\ + 8 8 \\ \hline 1 6 2}`,
      String.raw`\duanchu[result]{36, 48}`,
      String.raw`\duanchu*{2 | 36 48 \\ 18 24}`,
      String.raw`\shuzhuang{36}`,
      String.raw`\shuzhuang*{36 = 4 \times 9}`,
      String.raw`\shizi{x^2+5x+6}`,
      String.raw`\shizi*{x & +2 \\ x & +3}`,
      String.raw`\zonghe{(x^2+3x+2)\div(x+1)}`,
    ];
    for (const tex of cases) expect(translateFormula(tex).kind).toBe("svg");
  });

  test("递等式转成 TeX 交给 MathJax", () => {
    const r = translateFormula(String.raw`\dengshi[steps=1]{2\times3\times4+1}`);
    expect(r).toEqual({ kind: "tex", tex: buildDengshi(String.raw`2\times3\times4+1`, "steps=1") });
    expect(translateFormula(String.raw`\stepeq*{1+1 \\ 2}`).kind).toBe("tex");
  });

  test("写法错误给出带命令名的报错", () => {
    const r = translateFormula(String.raw`\shushi{7+}`);
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message.startsWith("\\shushi：")).toBe(true);
    const star = translateFormula(String.raw`\shushi*{7 + 4}`);
    if (star.kind === "error") expect(star.message.startsWith("\\shushi*：")).toBe(true);
    expect(star.kind).toBe("error");
    expect(translateFormula(String.raw`\shushi[nope]{74+88}`).kind).toBe("error");
    expect(translateFormula(String.raw`\dengshi{7\div3}`).kind).toBe("error");
    expect(translateFormula(String.raw`\dengshi[negative=false]{7-9}`).kind).toBe("error");
    expect(translateFormula(String.raw`\dengshi{7-9}`).kind).toBe("tex");
  });

  test("混写报错原样传出", () => {
    expect(translateFormula(String.raw`x+\shushi{1+1}`).kind).toBe("error");
  });
});

describe("translateFormulaMathML：复制为 MathML 时用", () => {
  test("竖式给 mstack，外面包 <math>", () => {
    const r = translateFormulaMathML(String.raw`\shushi{74+88}`);
    expect(r.kind).toBe("mathml");
    if (r.kind === "mathml") {
      expect(r.mathml).toContain("<math");
      expect(r.mathml).toContain("<mstack");
    }
  });

  test("其他画成 SVG 的写法只给朗读文字", () => {
    const r = translateFormulaMathML(String.raw`\duanchu{36}`);
    expect(r.kind).toBe("mathml");
    if (r.kind === "mathml") {
      expect(r.mathml).toContain("<mtext>");
      expect(r.mathml).toContain("短除法");
    }
  });

  test("递等式、普通公式、报错照常", () => {
    expect(translateFormulaMathML(String.raw`\dengshi{1+1}`).kind).toBe("tex");
    expect(translateFormulaMathML("x").kind).toBe("pass");
    expect(translateFormulaMathML(String.raw`\shushi{7+}`).kind).toBe("error");
  });

  test("朗读文字里的特殊字符要转义", () => {
    const r = translateFormulaMathML(String.raw`\shuzhuang{12}`);
    if (r.kind === "mathml") expect(r.mathml).not.toMatch(/<mtext>[^<]*[<>&][^<]*<\/mtext>/);
  });
});
