import { describe, expect, test } from "bun:test";
import {
  FORMULA_COMMAND_NAMES,
  createMathJaxMacros,
  embedMathML,
  inlineEmbeddedSvg,
  parseFormulaCommand,
  renderShushi,
  translateFormula,
  translateFormulaMathML,
  type MathJaxTexParser,
} from "../src/index.ts";

const MIXED = "74+88=162 \\quad \\shushi{74+88}";

describe("混写（2026-11-27）：交给接了本库扩展的 MathJax", () => {
  test("parseFormulaCommand / translateFormula / translateFormulaMathML 都返回 mixed", () => {
    expect(parseFormulaCommand(MIXED).kind).toBe("mixed");
    expect(parseFormulaCommand("\\shushi{74+88} \\quad x").kind).toBe("mixed");
    expect(translateFormula(MIXED).kind).toBe("mixed");
    expect(translateFormulaMathML(MIXED).kind).toBe("mixed");
  });
  test("整条公式只有本库命令时照旧", () => {
    expect(translateFormula("\\shushi{74+88}").kind).toBe("svg");
    expect(parseFormulaCommand("\\shushi{74+88").kind).toBe("error");
  });
  test("命令名清单含拼音与英文别名", () => {
    expect([...FORMULA_COMMAND_NAMES].sort()).toEqual(
      ["crossmul", "dengshi", "duanchu", "factortree", "shizi", "shortdiv", "shushi", "shuzhuang", "stepeq", "synthdiv", "vertical", "zonghe"].sort(),
    );
  });
});

/** 模拟 MathJax 的 TexParser：只实现宏用到的几个方法。 */
class FakeParser implements MathJaxTexParser {
  readonly pushed: unknown[] = [];
  constructor(public string: string, public i = 0) {}
  GetStar(): boolean {
    if (this.string[this.i] !== "*") return false;
    this.i += 1;
    return true;
  }
  GetBrackets(): string | undefined {
    if (this.string[this.i] !== "[") return undefined;
    const close = this.string.indexOf("]", this.i);
    const inner = this.string.slice(this.i + 1, close);
    this.i = close + 1;
    return inner;
  }
  GetArgument(): string {
    let depth = 0;
    const start = this.i;
    for (; this.i < this.string.length; this.i += 1) {
      const ch = this.string[this.i];
      if (ch === "{") depth += 1;
      if (ch === "}" && --depth === 0) break;
    }
    this.i += 1;
    return this.string.slice(start + 1, this.i - 1);
  }
  create(_kind: "node", type: string, children: unknown[] = [], attrs: Record<string, unknown> = {}): unknown {
    return { type, children, attrs };
  }
  Push(node: unknown): void {
    this.pushed.push(node);
  }
}

class FakeTexError extends Error {
  constructor(
    readonly id: string,
    message: string,
  ) {
    super(message);
  }
}

const macros = createMathJaxMacros(FakeTexError);
type Box = { type: string; children: { type: string; attrs: Record<string, string> }[]; attrs: Record<string, string> };

describe("MathJax 宏", () => {
  test("每个命令名都有宏", () => {
    expect(Object.keys(macros).sort()).toEqual([...FORMULA_COMMAND_NAMES].sort());
  });

  test("竖式：推入占好位置的空白盒子（Typora 的 ui/safe 会删掉 data: 地址，不能用图片字形），原命令放在 data 属性里", () => {
    const parser = new FakeParser("[guides=false]{74+88} + 1");
    macros.shushi!(parser, "\\shushi");
    expect(parser.string.slice(parser.i)).toBe(" + 1");
    const box = parser.pushed[0] as Box;
    expect(box.type).toBe("mrow");
    expect(box.attrs.class).toBe("cmn-embed");
    expect(box.attrs["data-cmn-svg"]).toBeUndefined();
    expect(box.attrs["data-cmn-tex"]).toBeDefined();
    const space = box.children[0]!;
    expect(space.type).toBe("mspace");
    const expected = renderShushi("74+88", "guides=false");
    // 居中对着公式中线（基线上方 0.25em）：基线以上 h/2+0.25，以下 h/2−0.25
    expect(space.attrs.width).toBe(`${expected.widthEm}em`);
    expect(Number.parseFloat(space.attrs.height!)).toBeCloseTo(expected.heightEm / 2 + 0.25, 5);
    expect(Number.parseFloat(space.attrs.depth!)).toBeCloseTo(expected.heightEm / 2 - 0.25, 5);
  });

  test("英文别名与带星号的直写", () => {
    const parser = new FakeParser("*{7 4 \\\\ + 8 8 \\\\ \\hline}");
    macros.vertical!(parser, "\\vertical");
    expect((parser.pushed[0] as { type: string }).type).toBe("mrow");
  });

  test("递等式：把转成的 TeX 放回输入，交给 MathJax 接着排；第一行对齐基线（S=\\dengshi{…} 读作 S=第一行）", () => {
    const parser = new FakeParser("{1+2+3} = 6");
    macros.dengshi!(parser, "\\dengshi");
    expect(parser.pushed).toEqual([]);
    expect(parser.i).toBe(0);
    expect(parser.string).toStartWith("{\\begin{aligned}[t]");
    expect(parser.string).toEndWith("} = 6");
  });

  test("写法错误抛 MathJax 的 TexError，消息带命令名", () => {
    const parser = new FakeParser("{7+}");
    expect(() => macros.shushi!(parser, "\\shushi")).toThrow(FakeTexError);
    expect(() => macros.shushi!(new FakeParser("{7+}"), "\\shushi")).toThrow(/\\shushi：/);
  });
});

describe("inlineEmbeddedSvg：在 MathJax 输出的空白盒子里插入本库的 SVG", () => {
  const parser = new FakeParser("{74+88}");
  macros.shushi!(parser, "\\shushi");
  const box = parser.pushed[0] as Box;
  const rendered = renderShushi("74+88");
  const mathjaxSvg = `<svg viewBox="0 -3062.5 12556 5625"><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="mrow" data-cmn-tex="${box.attrs["data-cmn-tex"]}" data-latex="\\shushi" class="cmn-embed" transform="translate(1572.2,0)"><g data-mml-node="mspace"></g></g></g></svg>`;

  test("插入翻转好的内联 SVG，尺寸按 MathJax 的 1/1000 em；去掉 data 属性", () => {
    const out = inlineEmbeddedSvg(mathjaxSvg);
    const w = rendered.widthEm * 1000;
    const h = rendered.heightEm * 1000;
    const up = (rendered.heightEm / 2 + 0.25) * 1000;
    expect(out).toContain(`<g transform="translate(0 ${up}) matrix(1 0 0 -1 0 0)"><svg width="${w}" height="${h}" preserveAspectRatio="none" fill="currentColor" stroke="none"`);
    expect(out).toContain('transform="translate(1572.2,0)"');
    expect(out).toContain(">7</text>");
    expect(out).not.toContain("data-cmn-");
    expect(out).not.toMatch(/<svg width="\d[^"]*em"/);
  });

  test("不信任携带的 SVG：只按 data-cmn-tex 重新画（伪造的 data-cmn-svg 插不进来）", () => {
    const b64 = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
    const evil = b64('<svg viewBox="0 0 24 24" width="1em" height="1em" onload="alert(1)"><script>alert(2)</script></svg>');
    const forged = `<svg><g class="cmn-embed" data-cmn-tex="${b64("\\shushi{1+1}")}" data-cmn-svg="${evil}"><g></g></g><g class="cmn-embed" data-cmn-svg="${evil}"><g></g></g></svg>`;
    const out = inlineEmbeddedSvg(forged);
    expect(out).not.toContain("onload");
    expect(out).not.toContain("<script");
    expect(out).toContain(">1</text>");
    expect(out).not.toContain("data-cmn-");
  });

  test("data-cmn-tex 不是一条合法的本库命令时盒子留空", () => {
    const b64 = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
    const out = inlineEmbeddedSvg(`<svg><g class="cmn-embed" data-cmn-tex="${b64("<script>")}"><g></g></g></svg>`);
    expect(out).toBe(`<svg><g class="cmn-embed"><g></g></g></svg>`);
  });

  test("没有本库盒子时原样不动", () => {
    const other = `<svg><g class="x"><image width="1" height="1" href="https://example.com/x.png"/></g></svg>`;
    expect(inlineEmbeddedSvg(other)).toBe(other);
  });
});

describe("embedMathML：复制为 MathML 时把嵌的图片换成本库的 MathML", () => {
  test("竖式换成 mstack；其他写法换成朗读文字", () => {
    const parser = new FakeParser("{74+88}");
    macros.shushi!(parser, "\\shushi");
    const box = parser.pushed[0] as Box;
    const mml = `<math display="block"><mn>1</mn><mrow class="cmn-embed" data-cmn-tex="${box.attrs["data-cmn-tex"]}" data-latex="\\shushi">\n  <mspace width="1em" height="1em" depth="0em"></mspace>\n</mrow></math>`;
    const out = embedMathML(mml);
    expect(out).not.toContain("cmn-embed");
    expect(out).not.toContain("mspace");
    expect(out).toContain("<mstack");
    expect(out.startsWith('<math display="block"><mn>1</mn>')).toBe(true);
    expect(out.match(/<math/g)?.length).toBe(1);
  });
});

describe("审查发现（2026-11-27 第二轮）", () => {
  test("embedMathML 遇到非法 base64 不抛异常，原样保留", () => {
    const mml = '<math><mrow data-cmn-tex="***"><mspace></mspace></mrow></math>';
    expect(embedMathML(mml)).toBe(mml);
  });
});

describe("安全审查（2026-11-27 第二轮）", () => {
  const b64 = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
  /** 去掉所有引号里的内容后，看标签外有没有多出元素。 */
  const outside = (s: string) => s.replace(/"[^"]*"/g, '""');

  test("C1：属性值里有不转义的 >（系统 WebKit 的序列化），插入的 SVG 不会错位、放出攻击者的元素", () => {
    const svg = `<svg><g data-mml-node="mrow" data-cmn-tex="${b64("\\shushi{1+2}")}" data-mjx-x=">X<img src=x onerror=alert(1)>" class="cmn-embed"><g data-mml-node="mspace"></g></g></svg>`;
    const out = inlineEmbeddedSvg(svg);
    expect(outside(out)).not.toContain("<img");
    expect(out).toContain(`data-mjx-x=">X<img src=x onerror=alert(1)>"`);
    expect(out).toContain(">3</text>");
    expect(out).not.toContain("data-cmn-");
  });

  test("C1（MathML 同款写法）：embedMathML 的标签匹配也认引号", () => {
    const mml = `<math><mrow data-cmn-tex="${b64("\\shushi{1+2}")}" data-mjx-x=">X<img src=x onerror=alert(1)>"><mspace width="1em"></mspace></mrow></math>`;
    const out = embedMathML(mml);
    expect(outside(out)).not.toContain("<img");
    expect(out).toContain("<mstack");
  });

  test("H1：语义式算式里的数最多 30 位", () => {
    expect(translateFormula(`\\shushi{${"9".repeat(31)}×2}`).kind).toBe("error");
    expect(translateFormula(`\\shushi{${"9".repeat(30)}×2}`).kind).toBe("svg");
  });
});
