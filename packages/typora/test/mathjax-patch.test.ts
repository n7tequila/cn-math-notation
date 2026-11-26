import { describe, expect, test } from "bun:test";
import { isPatched, patchMathJax, type ElementFactory, type MathJaxLike } from "../src/mathjax-patch.ts";

/** 假 MathJax：把收到的 TeX 记下来，返回带标记的对象。 */
function fakeMathJax() {
  const calls: string[] = [];
  const mj: MathJaxLike = {
    tex2svg: (tex: string) => {
      calls.push(`svg:${tex}`);
      return { mathjax: tex } as unknown as Element;
    },
    tex2svgPromise: async (tex: string) => {
      calls.push(`promise:${tex}`);
      return { mathjax: tex } as unknown as Element;
    },
    tex2mml: (tex: string) => {
      calls.push(`mml:${tex}`);
      return `<math>${tex}</math>`;
    },
  };
  return { mj, calls };
}

const factory: ElementFactory = {
  svg: (rendered, display) => ({ ours: rendered.label, display }) as unknown as Element,
  error: (message, display) => ({ error: message, display }) as unknown as Element,
};

describe("patchMathJax：包住 Typora 调用的 MathJax 入口", () => {
  test("普通公式原样交给 MathJax", async () => {
    const { mj, calls } = fakeMathJax();
    patchMathJax(mj, factory);
    expect(mj.tex2svg!("x", { display: false })).toEqual({ mathjax: "x" } as never);
    expect(await mj.tex2svgPromise!("y")).toEqual({ mathjax: "y" } as never);
    expect(mj.tex2mml!("z")).toBe("<math>z</math>");
    expect(calls).toEqual(["svg:x", "promise:y", "mml:z"]);
  });

  test("本库命令由本库画，按 display 区分块级与行内（默认块级）", async () => {
    const { mj, calls } = fakeMathJax();
    patchMathJax(mj, factory);
    expect(mj.tex2svg!(String.raw`\shushi{74+88}`, { display: false })).toEqual({
      ours: "竖式：74，加 88，162",
      display: false,
    } as never);
    expect(await mj.tex2svgPromise!(String.raw`\shushi{74+88}`)).toEqual({
      ours: "竖式：74，加 88，162",
      display: true,
    } as never);
    expect(calls).toEqual([]);
  });

  test("递等式先转成 TeX 再交给原来的 MathJax，选项原样传下去", () => {
    const { mj, calls } = fakeMathJax();
    const seen: unknown[] = [];
    const original = mj.tex2svg!;
    mj.tex2svg = (tex, opts) => {
      seen.push(opts);
      return original(tex, opts);
    };
    patchMathJax(mj, factory);
    mj.tex2svg!(String.raw`\dengshi{1+1}`, { display: true, em: 16 });
    expect(calls[0]!.startsWith("svg:\\begin{aligned}")).toBe(true);
    expect(seen).toEqual([{ display: true, em: 16 }]);
  });

  test("写错时返回报错元素，不抛异常", async () => {
    const { mj } = fakeMathJax();
    patchMathJax(mj, factory);
    const el = (await mj.tex2svgPromise!(String.raw`\shushi{7+}`)) as unknown as { error: string };
    expect(el.error.startsWith("\\shushi：")).toBe(true);
  });

  test("复制 MathML：竖式给 mstack，写错时给 merror", () => {
    const { mj } = fakeMathJax();
    patchMathJax(mj, factory);
    expect(mj.tex2mml!(String.raw`\shushi{74+88}`)).toContain("<mstack");
    expect(mj.tex2mml!(String.raw`\shushi{7+}`)).toContain("<merror>");
  });

  test("重复包不会套两层；还原后回到原函数", () => {
    const { mj } = fakeMathJax();
    const original = mj.tex2svg;
    const restore = patchMathJax(mj, factory);
    expect(isPatched(mj)).toBe(true);
    const once = mj.tex2svg;
    patchMathJax(mj, factory);
    expect(mj.tex2svg).toBe(once);
    restore();
    expect(mj.tex2svg).toBe(original);
    expect(isPatched(mj)).toBe(false);
  });

  test("MathJax 还没加载完（缺少入口）时不包", () => {
    const mj: MathJaxLike = {};
    patchMathJax(mj, factory);
    expect(isPatched(mj)).toBe(false);
  });
});
