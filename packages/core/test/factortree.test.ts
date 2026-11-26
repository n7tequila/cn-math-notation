import { describe, expect, test } from "bun:test";
import {
  ExpressionError,
  LayoutSyntaxError,
  OptionError,
  buildFactorTree,
  parseFactorTreeLayout,
  renderShuzhuang,
  renderShuzhuangLayout,
  type FactorTreeNode,
} from "../src/index.ts";

/** 树写成 36(2,18(2,9(3,3)))；质数叶子后面加 o（画圈）。 */
function shape(node: FactorTreeNode): string {
  const self = node.value + (node.circled ? "o" : "");
  return node.children.length === 0 ? self : `${self}(${node.children.map(shape).join(",")})`;
}

describe("树状图语义式", () => {
  test("默认每步拆出最小的质数，质数画圈", () => {
    expect(shape(buildFactorTree("36").root)).toBe("36(2o,18(2o,9(3o,3o)))");
  });

  test("split=half：每步拆成最接近的两个因数", () => {
    expect(shape(buildFactorTree("36", "split=half").root)).toBe("36(6(2o,3o),6(2o,3o))");
    expect(shape(buildFactorTree("60", "split=half").root)).toBe("60(6(2o,3o),10(2o,5o))");
  });

  test("circle=false 不画圈；result 写出结果算式", () => {
    expect(shape(buildFactorTree("12", "circle=false").root)).toBe("12(2,6(2,3))");
    expect(buildFactorTree("36", "result").result).toEqual(["36 = 2×2×3×3"]);
    expect(buildFactorTree("36").result).toEqual([]);
  });

  test("不能分解的报错", () => {
    expect(() => buildFactorTree("37")).toThrow(/质数/);
    expect(() => buildFactorTree("1")).toThrow(ExpressionError);
    expect(() => buildFactorTree("12, 18")).toThrow(ExpressionError);
    expect(() => buildFactorTree("12", "split=x")).toThrow(OptionError);
  });
});

describe("树状图直写", () => {
  test("逐条写等式；没拆的数是叶子", () => {
    // 不用 String.raw：Bun 会把模板里的 × 转写成字面的 \\u00D7
    const t = parseFactorTreeLayout("36 = 4 \\times 9 \\\\ 4 = 2 \\times 2 \\\\ 9 = 3 × 3");
    expect(shape(t.root)).toBe("36(4(2o,2o),9(3o,3o))");
  });

  test("相同的数先拆最左边还没拆的那个", () => {
    const t = parseFactorTreeLayout(String.raw`36 = 6 \times 6 \\ 6 = 2 \times 3`);
    expect(shape(t.root)).toBe("36(6(2o,3o),6)");
  });

  test("没拆完的合数不画圈；\\err 标出写错的数", () => {
    const t = parseFactorTreeLayout(String.raw`36 = 4 \times \err{8}`);
    expect(shape(t.root)).toBe("36(4,8)");
    expect(t.root.children[1]!.marks).toEqual(["err"]);
  });

  test("写法错误报错", () => {
    expect(() => parseFactorTreeLayout(String.raw`36 = 4 \times 9 \\ 5 = 5 \times 1`)).toThrow(/不在树上/);
    expect(() => parseFactorTreeLayout("36 = 4")).toThrow(LayoutSyntaxError);
    expect(() => parseFactorTreeLayout("36 4 9")).toThrow(LayoutSyntaxError);
    expect(() => parseFactorTreeLayout("")).toThrow(LayoutSyntaxError);
  });
});

describe("树状图渲染", () => {
  test("每条边一条线，质数画圈；朗读文字说出每次怎么拆", () => {
    const { svg, label } = renderShuzhuang("12");
    expect((svg.match(/class="cmn-tree-edge"/g) ?? []).length).toBe(4);
    expect((svg.match(/class="cmn-tree-circle"/g) ?? []).length).toBe(3);
    expect(label).toBe("树状图：12 分成 2 和 6，6 分成 2 和 3");
  });

  test("result 时下面写出结果算式；直写也能用", () => {
    expect(renderShuzhuang("12", "result").svg).toContain("12 = 2×2×3");
    expect(renderShuzhuangLayout(String.raw`12 = 3 \times 4 \\ 4 = 2 \times 2`, "result").svg).toContain("12 = 2×2×3");
  });

  test("直写的错误标记画出底色", () => {
    expect(renderShuzhuangLayout(String.raw`36 = 4 \times \err{8}`).svg).toContain("cmn-err");
  });

  test("直写不接受 split", () => {
    expect(() => renderShuzhuangLayout("12 = 3 \\times 4", "split=half")).toThrow(OptionError);
  });
});
