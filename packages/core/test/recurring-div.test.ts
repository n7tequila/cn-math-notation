import { describe, expect, test } from "bun:test";
import {
  DEFAULT_STYLE,
  buildSemantic,
  layoutToMathML,
  parseOptions,
  renderLayout,
  type Cell,
  type Layout,
  type Row,
} from "../src/index.ts";

const build = (expr: string, opts?: string) => buildSemantic(expr, parseOptions(opts, DEFAULT_STYLE));

/** 一行写成文字：小数点写成 .，省略号 …，循环点在数字后面记 '。 */
function text(cells: readonly Cell[]): string {
  return [...cells]
    .sort((a, b) => b.col - a.col)
    .map((c) => {
      const body = c.content.kind === "digit" ? c.content.text : c.content.kind === "ellipsis" ? "…" : "";
      const dot = c.marks.includes("xun") ? "'" : "";
      return body + dot + (c.point === "dot" ? "." : "");
    })
    .join("");
}

const digitRows = (layout: Layout) => layout.rows.filter((r): r is Extract<Row, { kind: "digits" }> => r.kind === "digits");
const quotient = (layout: Layout) => text(digitRows(layout).find((r) => r.quotient === true)!.cells);
const lastRow = (layout: Layout) => {
  const row = digitRows(layout).at(-1)!;
  return `${row.operator ?? ""}${text(row.cells)}`;
};
const hlines = (layout: Layout) => layout.rows.filter((r) => r.kind === "hline").length;

describe("商是循环小数：默认用红色循环点，竖式只除一个循环节（维护者 2026-11-28 Typora 实测后改）", () => {
  test("7÷3：竖式除到 2.3，商写 2.3 并在 3 上打循环点，最后写余数 1", () => {
    const layout = build("7÷3");
    expect(quotient(layout)).toBe("2.3'");
    expect(lastRow(layout)).toBe("1");
    expect(hlines(layout)).toBe(2);
  });
  test("1÷7、1÷6、28÷18 的循环点", () => {
    expect(quotient(build("1÷7"))).toBe("0.1'42857'");
    expect(quotient(build("1÷6"))).toBe("0.16'");
    expect(quotient(build("28÷18"))).toBe("1.5'");
  });
  test("循环点是红色的", () => {
    const svg = renderLayout(build("7÷3"), DEFAULT_STYLE).svg;
    expect(svg).toMatch(/class="cmn-xun"[^>]*fill="#d4402b"/);
  });
  test("ellipsis 或 repeatDot=false：改回省略号写法；写了 places 也用省略号写法", () => {
    expect(quotient(build("7÷3", "ellipsis"))).toBe("2.333…");
    expect(quotient(build("7÷3", "repeatDot=false"))).toBe("2.333…");
    expect(quotient(build("7÷3", "places=5"))).toBe("2.33333…");
  });
});

describe("省略号写法（ellipsis）：除到循环节完整一遍且至少 3 位", () => {
  test("7÷3：除到 2.333，商后面写省略号，最后写余数 1", () => {
    const layout = build("7÷3", "ellipsis");
    expect(quotient(layout)).toBe("2.333…");
    expect(lastRow(layout)).toBe("1");
    expect(hlines(layout)).toBe(4);
  });
  test("1÷7：循环节 6 位，除到 0.142857", () => {
    expect(quotient(build("1÷7", "ellipsis"))).toBe("0.142857…");
  });
  test("28÷18、1÷6：循环节短，仍至少除到 3 位", () => {
    expect(quotient(build("28÷18", "ellipsis"))).toBe("1.555…");
    expect(quotient(build("1÷6", "ellipsis"))).toBe("0.166…");
  });
  test("小数除数：1÷0.3 → 10÷3", () => {
    expect(quotient(build("1÷0.3", "ellipsis"))).toBe("3.333…");
  });
  test("places=N：除到第 N 位小数", () => {
    expect(quotient(build("7÷3", "places=5"))).toBe("2.33333…");
  });
  test("repeatDot：只除一个循环节，在循环节首尾数字上打循环点，不写省略号", () => {
    expect(quotient(build("7÷3", "repeatDot"))).toBe("2.3'");
    expect(quotient(build("1÷7", "repeatDot"))).toBe("0.1'42857'");
    expect(quotient(build("28÷18", "repeatDot"))).toBe("1.5'");
    expect(quotient(build("1÷6", "repeatDot"))).toBe("0.16'");
  });
  test("能除尽的题不受影响", () => {
    expect(quotient(build("12÷50"))).toBe("0.24");
    expect(quotient(build("12÷50", "places=5"))).toBe("0.24");
  });
});

describe("求商的近似值 round=N（维护者 2026-11-27）", () => {
  test("7÷3 保留两位：竖式除到第三位，下面写 ≈ 2.33", () => {
    const layout = build("7÷3", "round=2");
    expect(quotient(layout)).toBe("2.333");
    expect(lastRow(layout)).toBe("≈2.33");
  });
  test("四舍五入：5.8÷4 保留一位 → 1.45 ≈ 1.5；2÷3 保留整数 → 0.6 ≈ 1", () => {
    expect(quotient(build("5.8÷4", "round=1"))).toBe("1.45");
    expect(lastRow(build("5.8÷4", "round=1"))).toBe("≈1.5");
    expect(lastRow(build("2÷3", "round=0"))).toBe("≈1");
  });
  test("保留的位数末尾是 0 也写出来：0.7÷3 保留两位 ≈ 0.23；2.995÷1 保留两位 ≈ 3.00", () => {
    expect(lastRow(build("0.7÷3", "round=2"))).toBe("≈0.23");
    expect(lastRow(build("2.995÷1", "round=2"))).toBe("≈3.00");
  });
  test("本来就能除尽、位数不超过 N：照常画，不写 ≈", () => {
    expect(lastRow(build("5.8÷4", "round=2"))).toBe("0");
  });
});

describe("报错", () => {
  test("循环小数、近似值的孩子答案暂不支持", () => {
    expect(() => build("7÷3=2.33")).toThrow(/答案暂不支持/);
    expect(() => build("5.8÷4=1.5", "round=1")).toThrow(/答案暂不支持/);
  });
  test("remainder 与 round 不能同时用", () => {
    expect(() => build("7÷3", "remainder, round=1")).toThrow(/不能同时/);
  });
  test("循环节太长（1÷97 循环节 96 位）要写 places", () => {
    expect(() => build("1÷97")).toThrow(/places/);
    expect(() => build("1÷97", "ellipsis")).toThrow(/places/);
    expect(quotient(build("1÷97", "places=4"))).toBe("0.0103…");
  });
  test("places、round 的取值", () => {
    expect(() => build("7÷3", "places=0")).toThrow(/places/);
    expect(() => build("7÷3", "places=31")).toThrow(/places/);
    expect(() => build("7÷3", "round=11")).toThrow(/round/);
    expect(() => build("7÷3", "round=a")).toThrow(/round/);
  });
  test("repeatDot 时 places 不够写出一个循环节", () => {
    expect(() => build("1÷7", "repeatDot, places=3")).toThrow(/循环节/);
  });
});

describe("出图与 MathML", () => {
  test("SVG 画出省略号、循环点、约等号，朗读文字也带上", () => {
    const svg = renderLayout(build("7÷3", "round=2"), DEFAULT_STYLE).svg;
    expect(svg).toContain(">≈<");
    expect(svg).toContain("约等于");
    expect(renderLayout(build("7÷3", "ellipsis"), DEFAULT_STYLE).svg).toContain(">…<");
    expect(renderLayout(build("7÷3", "repeatDot"), DEFAULT_STYLE).svg).toContain("cmn-xun");
  });
  test("MathML：省略号 <mo>…</mo>，循环点用 mover，约等号 <mo>≈</mo>", () => {
    expect(layoutToMathML(build("7÷3", "ellipsis"))).toContain("<mo>…</mo>");
    expect(layoutToMathML(build("7÷3", "repeatDot"))).toContain("<mover");
    expect(layoutToMathML(build("7÷3", "round=2"))).toContain("<mo>≈</mo>");
  });
});

describe("审查发现（2026-11-27 第二轮）", () => {
  test("repeatDot 只除一个循环节：places 比循环节长也报错（否则写出 0.3̇3333）", () => {
    expect(() => build("1÷3", "repeatDot, places=5")).toThrow(/repeatDot/);
    expect(quotient(build("1÷7", "repeatDot, places=6"))).toBe("0.1'42857'");
  });
  test("朗读文字说出循环节", () => {
    expect(renderLayout(build("1÷7", "repeatDot"), DEFAULT_STYLE).label).toContain("循环节 142857");
  });
});

describe("混写时除法竖式的商那一行对齐基线（维护者 2026-11-28）", () => {
  test("除法竖式带 baselineEm（商那一行的基线离顶边的距离），其他竖式没有", async () => {
    const { renderShushi } = await import("../src/index.ts");
    const div = renderShushi("7÷3");
    expect(div.baselineEm).toBeGreaterThan(0);
    expect(div.baselineEm!).toBeLessThan(div.heightEm / 3);
    expect(renderShushi("74+88").baselineEm).toBeUndefined();
  });
});
