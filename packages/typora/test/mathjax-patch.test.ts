import { describe, expect, test } from "bun:test";
import { isPatched, patchMathJax, type ElementFactory, type MathJaxLike } from "../src/mathjax-patch.ts";
import { registerTexExtension } from "../src/tex-extension.ts";

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
  inline: (el) => ({ inlined: el }) as unknown as Element,
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

describe("混写（2026-11-27）", () => {
  const MIXED = String.raw`74+88=162 \quad \shushi{74+88}`;

  test("接上了 TeX 扩展：整条公式交给 MathJax，结果里嵌的图片换成内联 SVG", async () => {
    const { mj, calls } = fakeMathJax();
    patchMathJax(mj, factory, { mixed: true });
    expect(mj.tex2svg!(MIXED)).toEqual({ inlined: { mathjax: MIXED } } as never);
    expect(await mj.tex2svgPromise!(MIXED)).toEqual({ inlined: { mathjax: MIXED } } as never);
    expect(mj.tex2mml!(MIXED)).toBe(`<math>${MIXED}</math>`);
    expect(calls).toEqual([`svg:${MIXED}`, `promise:${MIXED}`, `mml:${MIXED}`]);
  });

  test("没接上扩展：照旧提示要单独写成一个公式", () => {
    const { mj, calls } = fakeMathJax();
    patchMathJax(mj, factory);
    const el = mj.tex2svg!(MIXED) as unknown as { error: string };
    expect(el.error).toContain("单独");
    expect(mj.tex2mml!(MIXED)).toContain("<merror>");
    expect(calls).toEqual([]);
  });
});

describe("registerTexExtension：往 Typora 的 MathJax 里注册本库命令", () => {
  function fakeRuntime() {
    const maps: { name: string; macros: string[] }[] = [];
    const added: unknown[] = [];
    class CommandMap {
      constructor(name: string, json: Record<string, unknown>) {
        maps.push({ name, macros: Object.keys(json) });
      }
    }
    class TexError extends Error {}
    const tex = { name: "TeX", parseOptions: { handlers: { add: (h: unknown) => added.push(h) } } };
    const mj = {
      _: { input: { tex: { TokenMap: { CommandMap }, TexError: { default: TexError } } } },
      startup: { document: { inputJax: [tex] } },
    };
    return { mj, maps, added };
  }

  test("建一个 CommandMap 放本库全部命令，加到 TeX 输入的宏处理里；重复调用不重复注册", () => {
    const { mj, maps, added } = fakeRuntime();
    expect(registerTexExtension(mj)).toBe(true);
    expect(registerTexExtension(mj)).toBe(true);
    expect(maps).toHaveLength(1);
    expect(maps[0]!.macros).toContain("shushi");
    expect(maps[0]!.macros).toContain("stepeq");
    expect(added).toEqual([{ macro: [maps[0]!.name] }]);
  });

  test("MathJax 重新加载、换了新的 TeX 输入（window.MathJax 仍是同一个对象）时重新注册", () => {
    const { mj, added } = fakeRuntime();
    expect(registerTexExtension(mj)).toBe(true);
    const fresh = { name: "TeX", parseOptions: { handlers: { add: (h: unknown) => added.push(h) } } };
    (mj.startup.document as { inputJax: unknown[] }).inputJax = [fresh];
    expect(registerTexExtension(mj)).toBe(true);
    expect(added).toHaveLength(2);
  });

  test("找不到内部接口时返回 false（不抛异常）", () => {
    expect(registerTexExtension({})).toBe(false);
    const { mj } = fakeRuntime();
    expect(registerTexExtension({ ...mj, startup: { document: { inputJax: [] } } })).toBe(false);
    expect(registerTexExtension({ ...mj, _: {} })).toBe(false);
  });
});

describe("core 给 Typora 的 DOM 版接口", () => {
  test("embeddedSvgFor / embeddedMathMLFor：按原命令重新画；不是合法命令时为空", async () => {
    const { embeddedSvgFor, embeddedMathMLFor } = await import("@cn-math-notation/core");
    const b64 = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
    expect(embeddedSvgFor(b64("\\shushi{1+2}"))).toContain(">3</text>");
    expect(embeddedSvgFor(b64("<img src=x onerror=alert(1)>"))).toBe("");
    expect(embeddedSvgFor("***")).toBe("");
    expect(embeddedMathMLFor(b64("\\shushi{1+2}"))).toContain("<mstack");
    expect(embeddedMathMLFor("***")).toBeUndefined();
  });
});

test("混写开关可以是函数：注册稍后成功时立即生效", () => {
  const { mj } = fakeMathJax();
  let registered = false;
  patchMathJax(mj, factory, { mixed: () => registered });
  const MIXED_TEX = String.raw`x+\shushi{1+1}`;
  expect((mj.tex2svg!(MIXED_TEX) as unknown as { error?: string }).error).toContain("单独");
  registered = true;
  expect(mj.tex2svg!(MIXED_TEX)).toEqual({ inlined: { mathjax: MIXED_TEX } } as never);
});
